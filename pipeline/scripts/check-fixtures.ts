#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import validateFixtureManifest from "../dist/validate-fixture-manifest.mjs";

const SIZE_BUDGET_BYTES = 256 * 1024; // per fixture file
const TOTAL_BUDGET_BYTES = 2 * 1024 * 1024;

const errors: string[] = [];
let totalSize = 0;

function walk(dir: string, fn: (path: string) => void) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, fn);
    else fn(path);
  }
}

function checkPack(packDir: string) {
  const manifestPath = join(packDir, "manifest.json");
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    errors.push(`${packDir}: missing or unreadable manifest.json`);
    return;
  }
  if (!validateFixtureManifest(manifest)) {
    for (const e of validateFixtureManifest.errors ?? []) {
      errors.push(`${manifestPath}#${e.instancePath} — ${e.message ?? e.keyword}`);
    }
  }

  const declared = (manifest as { hashes?: Record<string, string> }).hashes ?? {};
  walk(packDir, (path) => {
    const rel = path.slice(packDir.length + 1);
    if (rel === "manifest.json") return;
    const buf = readFileSync(path);
    totalSize += buf.length;
    if (buf.length > SIZE_BUDGET_BYTES) {
      errors.push(`${path}: ${buf.length} bytes exceeds per-file budget (${SIZE_BUDGET_BYTES})`);
    }
    if (/[A-Z]:\\|\/Users\/|\/home\//.test(buf.toString("utf8").slice(0, 64 * 1024))) {
      errors.push(`${path}: contains a machine-local path (Users/home/Windows drive)`);
    }
    const hash = createHash("sha256").update(buf).digest("hex");
    const expected = declared[rel];
    if (!expected) {
      errors.push(`${path}: hash not declared in ${manifestPath}`);
    } else if (expected !== "0".repeat(64) && expected !== hash) {
      errors.push(
        `${path}: hash mismatch (declared ${expected.slice(0, 12)}…, actual ${hash.slice(0, 12)}…)`,
      );
    }
  });
}

for (const dir of ["fixtures/synthetic", "fixtures/real-capsule"]) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
  // empty real-capsule placeholder until first curation
  if (!readdirSync(dir).some((e) => e === "manifest.json")) continue;
  checkPack(dir);
}

// Block accidentally-committed forbidden paths in CI checkouts.
for (const forbidden of ["snapshots", "site/static/data.sqlite", "site/static/assets"]) {
  if (statSync(forbidden, { throwIfNoEntry: false })) {
    if (process.env.CI === "true") {
      errors.push(`forbidden path present in CI checkout: ${forbidden}`);
    }
  }
}

if (totalSize > TOTAL_BUDGET_BYTES) {
  errors.push(`total fixture size ${totalSize} exceeds ${TOTAL_BUDGET_BYTES}`);
}

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.warn(`fixtures ok: ${totalSize} bytes total`);
