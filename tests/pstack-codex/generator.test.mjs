import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = join(REPO, "scripts/generate-pstack-codex.mjs");
const REVISION = "ae5650febf4320793844c12c4adaa937f417f8da";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function files(directory) {
  return readdirSync(directory).sort().flatMap((name) => {
    const path = join(directory, name);
    return lstatSync(path).isDirectory() ? files(path) : [path];
  });
}

function put(root, path, content, mode = 0o644) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  chmodSync(target, mode);
}

function snapshot(directory) {
  return Object.fromEntries(files(directory).map((path) => [relative(directory, path), {
    sha256: hash(readFileSync(path)), executableBits: lstatSync(path).mode & 0o111,
  }]));
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pstack-codex-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  copyFileSync(SCRIPT, join(root, "scripts/generate-pstack-codex.mjs"));
  put(root, "pstack/LICENSE", "MIT fixture license\n");
  put(root, "pstack/plugin.json", JSON.stringify({ name: "pstack", version: "0.15.36", license: "MIT" }));
  put(root, "pstack/skills/alpha/SKILL.md", `---
name: alpha
description: "Upstream explicit workflow."
disable-model-invocation: true
icon: crown
color: yellow
model: cursor-only
---
# Alpha

Read [the guide](references/my%20guide.md).
`);
  put(root, "pstack/skills/alpha/references/my guide.md", "# Source guide\n\n[Run](../scripts/run.mjs)\n");
  put(root, "pstack/skills/alpha/scripts/run.mjs", `#!/usr/bin/env node
import { value } from "./helper.mjs";
import { writeFileSync } from "node:fs";
writeFileSync("UPSTREAM-SCRIPT-EXECUTED", value);
`, 0o755);
  put(root, "pstack/skills/alpha/scripts/helper.mjs", 'export const value = "should never run";\n');
  put(root, "pstack/skills/alpha/playbooks/automatic-merge.md", "# Unadapted automation\n\nAutomatically merge the PR.\n");
  put(root, "pstack/skills/alpha/scripts/bootstrap.mjs", "throw Error('unreviewed bootstrap');\n");
  put(root, "pstack/skills/alpha/assets/data.bin", Buffer.from([0, 17, 128, 255]));
  put(root, "pstack/skills/alpha/agents/openai.yaml", `interface:
  display_name: "Alpha UI"
dependencies:
  tools: []
`);
  put(root, "pstack/skills/beta/SKILL.md", `---
name: beta
description: >-
  Explain the ordinary workflow
  when the user requests it.
metadata:
  short-description: Ordinary beta
---
# Beta

Read [alpha](../alpha/SKILL.md).
`);
  put(root, "adapters/codex/plugin/docs/codex.md", "# Local Codex contract\n\n[Home](../README.md)\n");
  put(root, "adapters/codex/plugin/README.md", "# Portable fixture\n\n[Contract](docs/codex.md)\n");
  put(root, "adapters/codex/plugin/skills/alpha/SKILL.md", `---
name: alpha
description: ${JSON.stringify('Adapted workflow with quoted "words".')}
disable-model-invocation: false
icon: ignored
context: fork
argument-hint: ignored
---
# Adapted alpha

Use [the guide](references/my%20guide.md) and [beta](../beta/SKILL.md).
`);
  put(root, "adapters/codex/plugin/skills/alpha/references/my guide.md", "# Overlaid guide\n\n[Run](../scripts/run.mjs)\n");
  const config = {
    schemaVersion: 1,
    upstream: { repository: "https://github.com/cursor/plugins", revision: REVISION, path: "pstack", version: "0.15.36" },
    plugin: {
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "fixture-codex", version: "0.1.0", description: "Portable test fixture.", license: "MIT",
      extensions: { "com.openai": { interface: { displayName: "Fixture", defaultPrompt: ["Use the fixture."] } } },
    },
    skills: ["alpha", "beta"], overlay: "adapters/codex/plugin", output: "harness/pstack-codex",
    resources: { alpha: ["references/my guide.md", "scripts/run.mjs", "scripts/helper.mjs", "assets/data.bin", "agents/openai.yaml"] },
  };
  put(root, "adapters/codex/config.json", JSON.stringify(config, null, 2) + "\n");
  const selected = ["LICENSE", "plugin.json", ...config.skills.flatMap((skill) => ["SKILL.md", ...(config.resources[skill] ?? [])].map((path) => `skills/${skill}/${path}`))];
  const lock = Object.fromEntries(selected.map((path) => [path, hash(readFileSync(join(root, "pstack", path)))]));
  put(root, "adapters/codex/upstream-files.json", JSON.stringify(lock, null, 2) + "\n");
  const output = join(root, "harness/pstack-codex");
  const run = (...args) => spawnSync(process.execPath, [join(root, "scripts/generate-pstack-codex.mjs"), ...args], { cwd: root, encoding: "utf8" });
  return { root, output, config, lock, run };
}

function ok(result) { assert.equal(result.status, 0, result.stdout + result.stderr); }
function rejected(result, pattern) { assert.notEqual(result.status, 0); assert.match(result.stdout + result.stderr, pattern); }

test("CLI builds a complete portable tree, preserves resources/modes/policy, and never executes helpers", (t) => {
  const f = fixture(t);
  ok(f.run());
  ok(f.run("--check"));
  const output = (path) => join(f.output, path);
  const alpha = readFileSync(output("skills/alpha/SKILL.md"), "utf8");
  assert.match(alpha, /Adapted workflow/);
  assert.equal((alpha.match(/\.\.\/\.\.\/docs\/codex\.md/g) ?? []).length, 1);
  assert.doesNotMatch(alpha.split("---")[1], /disable-model-invocation|icon:|context:|argument-hint:/);
  const yaml = readFileSync(output("skills/alpha/agents/openai.yaml"), "utf8");
  assert.match(yaml, /display_name: "Alpha UI"/);
  assert.match(yaml, /dependencies:\n  tools: \[\]/);
  assert.match(yaml, /policy:\n  allow_implicit_invocation: false/);
  assert.equal(existsSync(output("skills/beta/agents/openai.yaml")), false, "default discovery stays normal");
  assert.match(readFileSync(output("skills/beta/SKILL.md"), "utf8"), /Explain the ordinary workflow when the user requests it\./);
  assert.match(readFileSync(output("skills/alpha/references/my guide.md"), "utf8"), /Overlaid guide/);
  assert.deepEqual(readFileSync(output("skills/alpha/assets/data.bin")), Buffer.from([0, 17, 128, 255]));
  assert.equal(lstatSync(output("skills/alpha/scripts/run.mjs")).mode & 0o111, 0o111);
  assert.equal(lstatSync(output("skills/alpha/scripts/helper.mjs")).mode & 0o111, 0);
  assert.deepEqual(JSON.parse(readFileSync(output("plugin.json"))), f.config.plugin);
  assert.equal(existsSync(output(".codex-plugin")), false);
  assert.equal(existsSync(join(f.root, "UPSTREAM-SCRIPT-EXECUTED")), false);
  assert.equal(existsSync(output("skills/alpha/playbooks")), false);
  assert.equal(existsSync(output("skills/alpha/scripts/bootstrap.mjs")), false);
  const provenance = JSON.parse(readFileSync(output("UPSTREAM.json")));
  assert.equal(provenance.upstream.revision, REVISION);
  assert.equal(provenance.inputs["pstack/skills/alpha/scripts/run.mjs"].executableBits, 0o111);
  assert.equal(provenance.inputs["adapters/codex/plugin/skills/alpha/references/my guide.md"].sha256,
    hash(readFileSync(join(f.root, "adapters/codex/plugin/skills/alpha/references/my guide.md"))));
  const before = snapshot(f.output);
  ok(f.run());
  assert.deepEqual(snapshot(f.output), before, "repeated generation is byte/mode deterministic");
});

for (const kind of ["content", "added", "deleted", "executable"]) {
  test(`CLI --check discovers ${kind} drift without repairing it`, (t) => {
    const f = fixture(t);
    ok(f.run());
    const path = join(f.output, "skills/alpha/scripts/run.mjs");
    if (kind === "content") writeFileSync(path, "changed\n");
    if (kind === "added") put(f.output, "unexpected.txt", "extra\n");
    if (kind === "deleted") rmSync(path);
    if (kind === "executable") chmodSync(path, 0o644);
    const before = snapshot(f.output);
    rejected(f.run("--check"), /output drift/);
    assert.deepEqual(snapshot(f.output), before);
    ok(f.run());
    ok(f.run("--check"));
  });
}

for (const kind of ["changed", "added", "deleted", "missing-lock-key"]) {
  test(`source lock refuses ${kind} upstream input before touching an existing output`, (t) => {
    const f = fixture(t);
    ok(f.run());
    const before = snapshot(f.output);
    const path = join(f.root, "pstack/skills/alpha/scripts/helper.mjs");
    if (kind === "changed") writeFileSync(path, "export const value = 2;\n");
    if (kind === "added") {
      put(f.root, "pstack/skills/alpha/assets/new.bin", "new");
      f.config.resources.alpha.push("assets/new.bin");
      put(f.root, "adapters/codex/config.json", JSON.stringify(f.config));
    }
    if (kind === "deleted") rmSync(path);
    if (kind === "missing-lock-key") {
      delete f.lock["skills/alpha/scripts/helper.mjs"];
      put(f.root, "adapters/codex/upstream-files.json", JSON.stringify(f.lock));
    }
    rejected(f.run(), /source lock mismatch/);
    assert.deepEqual(snapshot(f.output), before);
  });
}

test("upstream revision pin drift fails even when source bytes and lock still match", (t) => {
  const f = fixture(t);
  f.config.upstream.revision = "0".repeat(40);
  put(f.root, "adapters/codex/config.json", JSON.stringify(f.config));
  rejected(f.run(), /Upstream pin mismatch: revision/);
  assert.equal(existsSync(f.output), false);
});

test("source executable bits are retained exactly and checked as provenance drift", (t) => {
  const f = fixture(t);
  ok(f.run());
  chmodSync(join(f.root, "pstack/skills/alpha/scripts/run.mjs"), 0o744);
  rejected(f.run("--check"), /output drift/);
  ok(f.run());
  assert.equal(lstatSync(join(f.output, "skills/alpha/scripts/run.mjs")).mode & 0o111, 0o100);
});

test("input overlay changes invalidate --check without invalidating the reviewed upstream lock", (t) => {
  const f = fixture(t);
  ok(f.run());
  put(f.root, "adapters/codex/plugin/docs/codex.md", "# Changed contract\n");
  rejected(f.run("--check"), /output drift/);
  ok(f.run());
  ok(f.run("--check"));
});

test("excluded build caches are neither locked nor copied", (t) => {
  const f = fixture(t);
  put(f.root, "pstack/skills/alpha/node_modules/unused.js", "throw Error('never');");
  put(f.root, "pstack/skills/alpha/.cache/temporary.bin", "cache");
  put(f.root, "pstack/skills/alpha/.DS_Store", "cache");
  ok(f.run());
  assert.equal(existsSync(join(f.output, "skills/alpha/node_modules")), false);
  assert.equal(existsSync(join(f.output, "skills/alpha/.cache")), false);
});

for (const kind of ["markdown", "typescript-import"]) {
  test(`portable ${kind} closure fails on an actual missing target`, (t) => {
    const f = fixture(t);
    if (kind === "markdown") put(f.root, "adapters/codex/plugin/docs/codex.md", "# Contract\n\n[Missing](missing.md)\n");
    else put(f.root, "adapters/codex/plugin/skills/alpha/scripts/new.ts", 'import { absent } from "./missing.ts";\n');
    rejected(f.run(), /closure failed.*|missing/s);
    assert.equal(existsSync(f.output), false);
  });
}

test("closure rejects plugin-escaping local links", (t) => {
  const f = fixture(t);
  put(f.root, "adapters/codex/plugin/docs/codex.md", "# Contract\n\n[Outside](../../outside.md)\n");
  rejected(f.run(), /escapes the plugin/);
});

test("invalid generated skill metadata fails before output writes", (t) => {
  const f = fixture(t);
  put(f.root, "adapters/codex/plugin/skills/alpha/SKILL.md", "---\nname: wrong-name\ndescription: Test workflow.\n---\n# Bad\n");
  rejected(f.run(), /Skill name must match/);
  assert.equal(existsSync(f.output), false);
});

test("relative --out, repository/source destinations and unowned external directories are refused", (t) => {
  const f = fixture(t);
  rejected(f.run("--out", "relative"), /absolute path/);
  for (const destination of [f.root, join(f.root, "pstack"), join(f.root, "adapters"), dirname(f.root)]) {
    rejected(f.run("--out", destination), /overlaps repository/);
  }
  const external = mkdtempSync(join(tmpdir(), "pstack-codex-unowned-"));
  t.after(() => rmSync(external, { recursive: true, force: true }));
  put(external, "keep.txt", "keep");
  rejected(f.run("--out", external), /not owned/);
  assert.equal(readFileSync(join(external, "keep.txt"), "utf8"), "keep");
});

test("absolute temporary output is reproducible and --check never creates a missing tree", (t) => {
  const f = fixture(t);
  const parent = mkdtempSync(join(tmpdir(), "pstack-codex-output-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const destination = join(parent, "generated");
  rejected(f.run("--check", "--out", destination), /output drift/);
  assert.equal(existsSync(destination), false);
  ok(f.run("--out", destination));
  const before = snapshot(destination);
  ok(f.run("--out", destination));
  ok(f.run("--check", "--out", destination));
  assert.deepEqual(snapshot(destination), before);
  assert.equal(existsSync(f.output), false);
});

test("source/output symlinks are rejected without following or replacing them", (t) => {
  const f = fixture(t);
  const parent = mkdtempSync(join(tmpdir(), "pstack-codex-links-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const destination = join(parent, "target");
  mkdirSync(destination);
  const link = join(parent, "link");
  symlinkSync(destination, link);
  rejected(f.run("--out", link), /Symbolic links/);
  assert.equal(lstatSync(link).isSymbolicLink(), true);
  const input = join(f.root, "pstack/skills/alpha/scripts/linked.mjs");
  symlinkSync(join(f.root, "pstack/skills/alpha/scripts/helper.mjs"), input);
  f.config.resources.alpha.push("scripts/linked.mjs");
  put(f.root, "adapters/codex/config.json", JSON.stringify(f.config));
  rejected(f.run(), /Symbolic links/);
  assert.equal(existsSync(f.output), false);
});

test("an ordinary adapter link cannot suppress the mandatory runtime prelude", (t) => {
  const f = fixture(t);
  put(f.root, "adapters/codex/plugin/skills/alpha/SKILL.md", "---\nname: alpha\ndescription: Adapted alpha.\n---\n# Alpha\n\nRead [contract](../../docs/codex.md).\n");
  ok(f.run());
  const text = readFileSync(join(f.output, "skills/alpha/SKILL.md"), "utf8");
  assert.equal((text.match(/<!-- pstack-codex-runtime -->/g) ?? []).length, 1);
  assert.match(text, /<!-- pstack-codex-runtime -->\nRead .*before following this skill\./);
  assert.equal((text.match(/\.\.\/\.\.\/docs\/codex\.md/g) ?? []).length, 2, "ordinary body reference is preserved alongside the required prelude");
  const before = snapshot(f.output);
  ok(f.run());
  assert.deepEqual(snapshot(f.output), before);
});

test("a new upstream resource enters output only after explicit selection and lock refresh", (t) => {
  const f = fixture(t);
  put(f.root, "pstack/skills/alpha/assets/new-reviewed.bin", "new resource");
  ok(f.run());
  assert.equal(existsSync(join(f.output, "skills/alpha/assets/new-reviewed.bin")), false);
  f.config.resources.alpha.push("assets/new-reviewed.bin");
  put(f.root, "adapters/codex/config.json", JSON.stringify(f.config));
  rejected(f.run(), /source lock mismatch/);
  f.lock["skills/alpha/assets/new-reviewed.bin"] = hash(Buffer.from("new resource"));
  put(f.root, "adapters/codex/upstream-files.json", JSON.stringify(f.lock));
  ok(f.run());
  assert.equal(readFileSync(join(f.output, "skills/alpha/assets/new-reviewed.bin"), "utf8"), "new resource");
});

test("allowlists cannot select resources outside their skill or include build caches", (t) => {
  const f = fixture(t);
  for (const path of ["../beta/SKILL.md", "/outside", "scripts/../../outside", "node_modules/hidden.js"]) {
    f.config.resources.alpha = [path];
    put(f.root, "adapters/codex/config.json", JSON.stringify(f.config));
    rejected(f.run(), /Unsafe relative path|Build caches/);
    assert.equal(existsSync(f.output), false);
  }
});

test("the real reviewed package excludes original poteto automation and statechart development corpus", (t) => {
  assert.equal(existsSync(join(REPO, "pstack/skills/poteto-mode/playbooks/feature.md")), true);
  assert.equal(existsSync(join(REPO, "pstack/skills/poteto-mode/scripts/bootstrap.ts")), true);
  const parent = mkdtempSync(join(tmpdir(), "pstack-codex-real-package-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const destination = join(parent, "package");
  const result = spawnSync(process.execPath, [SCRIPT, "--out", destination], { cwd: REPO, encoding: "utf8" });
  ok(result);
  assert.equal(existsSync(join(destination, "skills/poteto-mode/playbooks")), false);
  assert.equal(existsSync(join(destination, "skills/poteto-mode/scripts")), false);
  assert.equal(existsSync(join(destination, "skills/statechart/scripts/test")), false);
  assert.equal(existsSync(join(destination, "skills/statechart/scripts/corpus")), false);
  const packageJson = JSON.parse(readFileSync(join(destination, "skills/statechart/scripts/package.json")));
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(packageJson.scripts?.test, undefined);
  const sourceLauncher = join(REPO, "pstack/skills/statechart/scripts/statechart");
  const packagedLauncher = join(destination, "skills/statechart/scripts/statechart");
  assert.equal(lstatSync(packagedLauncher).mode & 0o111, lstatSync(sourceLauncher).mode & 0o111);
  const config = JSON.parse(readFileSync(join(REPO, "adapters/codex/config.json")));
  const provenance = JSON.parse(readFileSync(join(destination, "UPSTREAM.json")));
  const selected = new Set(["pstack/LICENSE", "pstack/plugin.json", ...config.skills.flatMap((skill) =>
    ["SKILL.md", ...(config.resources[skill] ?? [])].map((path) => `pstack/skills/${skill}/${path}`))]);
  assert.deepEqual(Object.keys(provenance.inputs).filter((path) => path.startsWith("pstack/")).sort(), [...selected].sort());
});
