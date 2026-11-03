#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedJar = "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88";
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

try {
  const { values } = parseArgs({ options: {
    java: { type: "string" }, tlc: { type: "string" }, out: { type: "string" },
  } });
  for (const key of ["java", "tlc", "out"])
    if (!values[key] || !isAbsolute(values[key])) throw new Error(`--${key} needs an absolute path`);
  if (existsSync(values.out)) throw new Error("--out must be a new directory");
  if (digest(values.tlc) !== expectedJar) throw new Error("TLC 1.7.4 JAR digest mismatch");
  const javaVersion = spawnSync(values.java, ["-version"], { encoding: "utf8", timeout: 10000 });
  if (javaVersion.error || javaVersion.status !== 0) throw new Error("Configured Java cannot run");
  const launcher = join(root, "harness/pstack-codex/skills/statechart/scripts/statechart");
  const fixture = join(root, "examples/pstack-codex/async-owner");
  mkdirSync(values.out, { recursive: true });
  const cases = [];
  for (const [name, expectedExit] of [["safe", 0], ["broken", 1], ["missing-dependencies", 2]]) {
    const env = { ...process.env };
    if (name === "missing-dependencies") {
      delete env.JAVA;
      delete env.TLA2TOOLS;
    } else {
      env.JAVA = values.java;
      env.TLA2TOOLS = values.tlc;
    }
    const destination = join(values.out, name);
    const args = [join(fixture, "Owner.tla"), "--config", join(fixture, name === "broken" ? "broken.cfg" : "safe.cfg"),
      "--view", join(fixture, "view.ts"), "--out", destination];
    const result = spawnSync(launcher, args, {
      cwd: values.out, env, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024,
    });
    writeFileSync(join(values.out, `${name}.stdout.txt`), result.stdout ?? "");
    writeFileSync(join(values.out, `${name}.stderr.txt`), result.stderr ?? "");
    let passed = !result.error && result.status === expectedExit;
    const report = join(destination, "report.md");
    if (name === "missing-dependencies") {
      passed &&= (result.stderr ?? "").includes("No dependency was installed.") && !existsSync(report);
    } else {
      passed &&= existsSync(report) && existsSync(join(destination, "chart.mmd"));
      if (name === "broken") passed &&= readFileSync(report, "utf8").includes("CancelStaysTerminal");
    }
    cases.push({ name, expectedExit, actualExit: result.status, passed, signal: result.signal,
      error: result.error?.code ?? null, reportPresent: existsSync(report) });
  }
  const receipt = {
    schema: "pstack-codex-statechart-smoke-v1", passed: cases.every((item) => item.passed),
    runtime: { node: process.version, java: (javaVersion.stderr || javaVersion.stdout).split("\n")[0], tlcSha256: expectedJar },
    inputs: Object.fromEntries([
      "examples/pstack-codex/async-owner/Owner.tla", "examples/pstack-codex/async-owner/safe.cfg",
      "examples/pstack-codex/async-owner/broken.cfg", "examples/pstack-codex/async-owner/view.ts",
      "harness/pstack-codex/UPSTREAM.json", "scripts/verify-pstack-codex-statechart.mjs",
    ].map((path) => [path, digest(join(root, path))])),
    cases, installedPlugin: false, evidenceScope: "Bounded generic model and runner behavior; no product or device acceptance",
  };
  writeFileSync(join(values.out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify({ passed: receipt.passed, cases, receipt: join(values.out, "receipt.json") }));
  if (!receipt.passed) process.exitCode = 1;
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 2;
}
