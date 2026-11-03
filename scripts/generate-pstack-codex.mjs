#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  realpathSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const CONFIG = "adapters/codex/config.json";
const LOCK = "adapters/codex/upstream-files.json";
const OUTPUT = "harness/pstack-codex";
const GENERATOR = "scripts/generate-pstack-codex.mjs";
const UPSTREAM = Object.freeze({
  repository: "https://github.com/cursor/plugins",
  revision: "ae5650febf4320793844c12c4adaa937f417f8da",
  path: "pstack",
  version: "0.15.36",
});
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CACHE_NAMES = new Set([
  "node_modules", ".DS_Store", ".git", ".cache", ".turbo", ".next",
  ".parcel-cache", ".pytest_cache", "__pycache__", ".tsbuildinfo",
  "buildcache", "build-cache", ".build-cache",
]);
const FRONTMATTER_KEYS = new Set(["name", "description", "license", "compatibility", "metadata"]);
const ADAPTER_LINK = "../../docs/codex.md";

function fail(message) { throw new Error(message); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function slash(path) { return path.split(sep).join("/"); }
function inside(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}
function pathKey(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.includes("\0") || isAbsolute(path)
      || path.split("/").some((part) => !part || part === "." || part === "..")) {
    fail(`Unsafe relative path: ${JSON.stringify(path)}`);
  }
  return path;
}

function noSymlinks(path) {
  let current = parse(path).root;
  for (const part of path.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (stat.isSymbolicLink()) {
      // macOS exposes these system directories through canonical aliases.
      if (current === "/tmp" || current === "/var") continue;
      fail(`Symbolic links are not supported: ${current}`);
    }
  }
}

function canonical(path) {
  noSymlinks(path);
  let parent = path;
  const tail = [];
  while (!existsSync(parent)) {
    tail.unshift(basename(parent));
    parent = dirname(parent);
  }
  return join(realpathSync(parent), ...tail);
}

function read(path) {
  noSymlinks(path);
  const stat = lstatSync(path);
  if (!stat.isFile()) fail(`Expected a regular file: ${path}`);
  return { bytes: readFileSync(path), executableBits: stat.mode & 0o111 };
}

function walk(directory, excludeCaches = true) {
  noSymlinks(directory);
  if (!lstatSync(directory).isDirectory()) fail(`Expected a directory: ${directory}`);
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    if (excludeCaches && (CACHE_NAMES.has(name) || name.endsWith(".tsbuildinfo"))) continue;
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) fail(`Symbolic links are not supported: ${path}`);
    if (stat.isDirectory()) files.push(...walk(path, excludeCaches));
    else if (stat.isFile()) files.push(path);
    else fail(`Unsupported filesystem entry: ${path}`);
  }
  return files;
}

function json(path) {
  try { return JSON.parse(read(join(ROOT, path)).bytes.toString("utf8")); }
  catch (error) { fail(`Cannot read ${path}: ${error.message}`); }
}

function validateConfig(config) {
  if (config.schemaVersion !== 1) fail("Expected config schemaVersion: 1");
  for (const [key, value] of Object.entries(UPSTREAM)) {
    if (config.upstream?.[key] !== value) fail(`Upstream pin mismatch: ${key}; expected ${value}`);
  }
  if (config.output !== OUTPUT || config.overlay !== "adapters/codex/plugin")
    fail("Config output/overlay must use the reviewed Codex locations");
  if (!Array.isArray(config.skills) || !config.skills.length || new Set(config.skills).size !== config.skills.length)
    fail("Config skills must be a nonempty array without duplicates");
  for (const skill of config.skills) {
    if (typeof skill !== "string" || !NAME.test(skill) || skill.length > 64) fail(`Invalid selected skill: ${skill}`);
  }
  if (!config.resources || typeof config.resources !== "object" || Array.isArray(config.resources)) fail("Config resources must be an explicit per-skill file map");
  for (const [skill, resources] of Object.entries(config.resources)) {
    if (!config.skills.includes(skill) || !Array.isArray(resources) || new Set(resources).size !== resources.length)
      fail(`Invalid resource allowlist: ${skill}`);
    for (const resource of resources) {
      pathKey(resource);
      if (resource.split("/").some((part) => CACHE_NAMES.has(part) || part.endsWith(".tsbuildinfo")))
        fail(`Build caches cannot be selected resources: ${skill}/${resource}`);
    }
  }
  if (!config.plugin || typeof config.plugin !== "object" || Array.isArray(config.plugin)) fail("Missing portable plugin metadata");
  if (!NAME.test(config.plugin.name ?? "") || config.plugin.name.length > 64) fail("Invalid plugin name");
  if (typeof config.plugin.description !== "string" || !config.plugin.description.trim()) fail("Missing plugin description");
  if (typeof config.plugin.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(config.plugin.version))
    fail("Invalid plugin version");
}

// Preserve supported YAML blocks without pretending to implement all YAML.
// Required scalar fields are decoded and re-emitted as unambiguous JSON strings.
function yamlBlocks(text, label) {
  const blocks = new Map();
  let current;
  for (const line of text.split("\n")) {
    if (!line.trim() || /^\s*#/.test(line)) { if (current) blocks.get(current).push(line); continue; }
    const match = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s|$)/.exec(line);
    if (match) {
      current = match[1];
      if (blocks.has(current)) fail(`Duplicate YAML key ${current}: ${label}`);
      blocks.set(current, [line]);
    } else if (/^\s/.test(line) && current) blocks.get(current).push(line);
    else fail(`Unsupported YAML syntax: ${label}: ${line}`);
  }
  return blocks;
}

function scalar(block, label) {
  if (!block) return undefined;
  const first = block[0].slice(block[0].indexOf(":") + 1).trim();
  if (/^[>|][+-]?$/.test(first)) {
    const lines = block.slice(1);
    const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length));
    const content = lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
    return first.startsWith(">") ? content.join(" ").trim() : content.join("\n").trimEnd();
  }
  if (block.slice(1).some((line) => line.trim() && !/^\s*#/.test(line))) fail(`Unsupported scalar continuation: ${label}`);
  if (first.startsWith('"')) {
    try { return JSON.parse(first); } catch { fail(`Invalid quoted YAML scalar: ${label}`); }
  }
  if (first.startsWith("'")) {
    if (!first.endsWith("'")) fail(`Invalid quoted YAML scalar: ${label}`);
    return first.slice(1, -1).replaceAll("''", "'");
  }
  return first.replace(/\s+#.*$/, "").trim();
}

function frontmatter(text, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) fail(`Missing YAML frontmatter: ${label}`);
  const blocks = yamlBlocks(match[1].replaceAll("\r\n", "\n"), label);
  const disable = scalar(blocks.get("disable-model-invocation"), label);
  if (disable !== undefined && disable !== "true" && disable !== "false") fail(`Invalid disable-model-invocation: ${label}`);
  return { blocks, disabled: disable === "true", body: text.slice(match[0].length).replace(/^\s*\n/, "") };
}

function renderSkill(text, skill) {
  const parsed = frontmatter(text, `skills/${skill}/SKILL.md`);
  const name = scalar(parsed.blocks.get("name"), skill);
  const description = scalar(parsed.blocks.get("description"), skill);
  if (name !== skill || !NAME.test(name ?? "") || name.length > 64) fail(`Skill name must match its valid directory: ${skill}`);
  if (typeof description !== "string" || !description.trim() || description.length > 1024 || /[<>]/.test(description))
    fail(`Invalid skill description: ${skill}`);
  const lines = [`name: ${JSON.stringify(name)}`, `description: ${JSON.stringify(description)}`];
  for (const [key, block] of parsed.blocks) {
    if (FRONTMATTER_KEYS.has(key) && key !== "name" && key !== "description") lines.push(block.join("\n").trimEnd());
  }
  const body = parsed.body.replace(/<!-- pstack-codex-runtime -->\n[\s\S]*?<!-- \/pstack-codex-runtime -->\n*/g, "");
  if (/<!--\s*\/?pstack-codex-runtime\s*-->/.test(body)) fail(`Malformed generated runtime marker in ${skill}`);
  const prelude = `<!-- pstack-codex-runtime -->\nRead [the Codex adapter](${ADAPTER_LINK}) once per session before following this skill.\n<!-- /pstack-codex-runtime -->\n\n`;
  return Buffer.from(`---\n${lines.join("\n")}\n---\n\n${prelude}${body.trimEnd()}\n`);
}

function invocationPolicy(entry, label) {
  if (!entry) return { bytes: Buffer.from("policy:\n  allow_implicit_invocation: false\n"), executableBits: 0 };
  const text = entry.bytes.toString("utf8").replaceAll("\r\n", "\n");
  const blocks = yamlBlocks(text, label);
  const policy = blocks.get("policy");
  if (!policy) return { ...entry, bytes: Buffer.from(`${text.trimEnd()}\n\npolicy:\n  allow_implicit_invocation: false\n`) };
  if (policy[0].trim() !== "policy:") fail(`Expected a block-style invocation policy: ${label}`);
  const matches = policy.filter((line) => /^\s+allow_implicit_invocation:/.test(line));
  if (matches.length > 1) fail(`Duplicate invocation policy: ${label}`);
  const updated = matches.length
    ? policy.map((line) => /^\s+allow_implicit_invocation:/.test(line) ? "  allow_implicit_invocation: false" : line)
    : [...policy, "  allow_implicit_invocation: false"];
  return { ...entry, bytes: Buffer.from(text.replace(policy.join("\n"), updated.join("\n")).trimEnd() + "\n") };
}

function markdownTargets(text) {
  const targets = [];
  // Inline/image links and reference definitions; angle-wrapped paths support spaces.
  for (const match of text.matchAll(/\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g)) targets.push(match[1] ?? match[2]);
  for (const match of text.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm)) targets.push(match[1] ?? match[2]);
  return targets;
}

function localTarget(from, target) {
  if (!target || target.startsWith("#") || target.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  let clean;
  try { clean = decodeURIComponent(target.replace(/[#?].*$/, "")); }
  catch { fail(`Invalid escaped path in ${from}: ${target}`); }
  if (!clean) return undefined;
  if (clean.includes("\\") || clean.startsWith("/")) fail(`Non-portable local path in ${from}: ${target}`);
  const path = slash(relative(ROOT, resolve(ROOT, dirname(from), clean)));
  if (!path || path === ".." || path.startsWith("../")) fail(`Local link escapes the plugin in ${from}: ${target}`);
  return path;
}

function has(files, path) { return files.has(path) || [...files.keys()].some((name) => name.startsWith(`${path}/`)); }

export function validateClosure(files) {
  const errors = [];
  for (const [path, entry] of files) {
    const text = entry.bytes.toString("utf8");
    if (path.endsWith(".md")) {
      for (const target of markdownTargets(text)) {
        const local = localTarget(path, target);
        if (local && !has(files, local)) errors.push(`${path} links to missing ${target}`);
      }
    }
    if (/\.(?:[cm]?js|tsx?)$/.test(path)) {
      const imports = [
        ...text.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g),
        ...text.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g),
      ];
      for (const [, target] of imports) {
        if (!target.startsWith(".")) continue;
        const local = localTarget(path, target);
        const candidates = [local, ...[".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", "/index.ts", "/index.js"].map((suffix) => `${local}${suffix}`)];
        if (!candidates.some((candidate) => files.has(candidate))) errors.push(`${path} imports missing ${target}`);
      }
    }
  }
  if (errors.length) fail(`Portable link/import closure failed:\n${errors.join("\n")}`);
}

export function render() {
  const config = json(CONFIG);
  validateConfig(config);
  const source = join(ROOT, config.upstream.path);
  const sourceFiles = new Map();
  for (const skill of config.skills) {
    const directory = join(source, "skills", skill);
    if (!existsSync(join(directory, "SKILL.md"))) fail(`Missing selected upstream skill: ${skill}`);
    for (const resource of new Set(["SKILL.md", ...(config.resources[skill] ?? [])])) {
      const path = join(directory, resource);
      if (!existsSync(path)) fail(`Upstream source lock mismatch: missing selected file skills/${skill}/${resource}`);
      sourceFiles.set(`skills/${skill}/${resource}`, read(path));
    }
  }
  for (const path of ["LICENSE", "plugin.json"]) sourceFiles.set(path, read(join(source, path)));
  const sourceLock = json(LOCK);
  if (!sourceLock || typeof sourceLock !== "object" || Array.isArray(sourceLock)) fail("Expected a source SHA256 map");
  for (const [path, digest] of Object.entries(sourceLock)) {
    pathKey(path);
    if (!/^[0-9a-f]{64}$/.test(digest)) fail(`Invalid source-lock SHA256: ${path}`);
  }
  const changed = [...new Set([...sourceFiles.keys(), ...Object.keys(sourceLock)])].sort().filter((path) => !sourceFiles.has(path) || sourceLock[path] !== hash(sourceFiles.get(path).bytes));
  if (changed.length) fail(`Upstream source lock mismatch (missing/added/changed):\n${changed.join("\n")}`);
  const upstreamPlugin = JSON.parse(sourceFiles.get("plugin.json").bytes.toString("utf8"));
  if (upstreamPlugin.version !== UPSTREAM.version || upstreamPlugin.license !== "MIT") fail("Upstream plugin version/license differs from the reviewed source");

  const files = new Map([...sourceFiles].filter(([path]) => path !== "plugin.json"));
  const overlayFiles = new Map();
  for (const path of walk(join(ROOT, config.overlay))) {
    const key = slash(relative(join(ROOT, config.overlay), path));
    if (["plugin.json", "UPSTREAM.json", "LICENSE"].includes(key) || key.startsWith(".codex-plugin/")) fail(`Reserved overlay path: ${key}`);
    if (key.startsWith("skills/") && !config.skills.includes(key.split("/")[1])) fail(`Overlay contains an unselected skill: ${key}`);
    const entry = read(path);
    files.set(key, entry);
    overlayFiles.set(key, entry);
  }
  if (!files.has("docs/codex.md")) fail("The overlay must supply docs/codex.md");
  for (const skill of config.skills) {
    const path = `skills/${skill}/SKILL.md`;
    const upstreamMetadata = frontmatter(sourceFiles.get(path).bytes.toString("utf8"), path);
    const selectedMetadata = frontmatter(files.get(path).bytes.toString("utf8"), path);
    files.set(path, { ...files.get(path), bytes: renderSkill(files.get(path).bytes.toString("utf8"), skill) });
    if (upstreamMetadata.disabled || selectedMetadata.disabled) {
      const policy = `skills/${skill}/agents/openai.yaml`;
      files.set(policy, invocationPolicy(files.get(policy), policy));
    }
  }
  files.set("plugin.json", { bytes: Buffer.from(JSON.stringify(config.plugin, null, 2) + "\n"), executableBits: 0 });
  validateClosure(files);
  const inputs = new Map([[CONFIG, read(join(ROOT, CONFIG))], [LOCK, read(join(ROOT, LOCK))], [GENERATOR, read(join(ROOT, GENERATOR))]]);
  for (const [path, entry] of sourceFiles) inputs.set(`${UPSTREAM.path}/${path}`, entry);
  for (const [path, entry] of overlayFiles) inputs.set(`${config.overlay}/${path}`, entry);
  const provenance = {
    schemaVersion: 1, generatedBy: GENERATOR, upstream: UPSTREAM,
    skills: [...config.skills], resources: config.resources,
    inputs: Object.fromEntries([...inputs].sort(([a], [b]) => a.localeCompare(b, "en")).map(([path, entry]) => [path, { sha256: hash(entry.bytes), executableBits: entry.executableBits }])),
  };
  files.set("UPSTREAM.json", { bytes: Buffer.from(JSON.stringify(provenance, null, 2) + "\n"), executableBits: 0 });
  return files;
}

function outputDirectory(value) {
  if (value !== undefined && !isAbsolute(value)) fail("--out requires an absolute path");
  const output = canonical(value ?? join(ROOT, OUTPUT));
  const fixed = canonical(join(ROOT, OUTPUT));
  if (output === ROOT || (inside(ROOT, output) && output !== fixed) || inside(output, ROOT)) fail(`Refusing output that overlaps repository sources: ${output}`);
  if (output === parse(output).root) fail("Refusing filesystem root as output");
  if (existsSync(output) && readdirSync(output).length && output !== fixed) {
    const marker = join(output, "UPSTREAM.json");
    let metadata;
    try { metadata = JSON.parse(read(marker).bytes.toString("utf8")); } catch { fail(`Refusing nonempty output not owned by this generator: ${output}`); }
    if (metadata.generatedBy !== GENERATOR || metadata.schemaVersion !== 1) fail(`Refusing unowned output: ${output}`);
  }
  return output;
}

export function main(args = process.argv.slice(2)) {
  let check = false, out;
  for (let i = 0; i < args.length; ++i) {
    if (args[i] === "--check" && !check) check = true;
    else if (args[i] === "--out" && out === undefined && args[i + 1]) out = args[++i];
    else fail(`Unknown or incomplete argument: ${args[i]}`);
  }
  const output = outputDirectory(out);
  const files = render();
  const actual = new Map(existsSync(output) ? walk(output, false).map((path) => [slash(relative(output, path)), read(path)]) : []);
  const drift = [...new Set([...files.keys(), ...actual.keys()])].sort().filter((path) => {
    const want = files.get(path), have = actual.get(path);
    return !want || !have || !want.bytes.equals(have.bytes) || want.executableBits !== have.executableBits;
  });
  if (check) {
    if (drift.length) fail(`Generated pstack-codex output drift:\n${drift.join("\n")}\nRun node ${GENERATOR}`);
    console.log(`pstack-codex is up to date (${files.size} files).`);
    return;
  }
  const staging = `${output}.tmp-${process.pid}`;
  noSymlinks(staging);
  if (existsSync(staging)) fail(`Staging directory already exists: ${staging}`);
  try {
    mkdirSync(staging, { recursive: true });
    for (const [path, entry] of [...files].sort(([a], [b]) => a.localeCompare(b, "en"))) {
      pathKey(path);
      mkdirSync(dirname(join(staging, path)), { recursive: true });
      writeFileSync(join(staging, path), entry.bytes);
      chmodSync(join(staging, path), 0o644 | entry.executableBits);
    }
    rmSync(output, { recursive: true, force: true });
    renameSync(staging, output);
  } finally { rmSync(staging, { recursive: true, force: true }); }
  console.log(`Generated pstack-codex (${files.size} files).`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`FAIL ${error.message}`); process.exitCode = 1; }
}
