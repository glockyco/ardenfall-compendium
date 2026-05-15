#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(import.meta.dirname, "..", ".svelte-kit", "cloudflare");
const releasePath = join(import.meta.dirname, "..", "static", "_release.json");
const outputReleasePath = join(outputDir, "_release.json");
const overviewPath = firstExisting([
  join(outputDir, "items", "index.html"),
  join(outputDir, "items.html"),
]);

if (!existsSync(releasePath)) throw new Error(`missing staged release metadata: ${releasePath}`);
if (!existsSync(outputReleasePath)) {
  throw new Error(`missing built release metadata: ${outputReleasePath}`);
}
if (!overviewPath) {
  throw new Error(`missing prerendered item overview under ${outputDir}`);
}

const manifest = JSON.parse(readFileSync(releasePath, "utf8"));
const builtManifest = JSON.parse(readFileSync(outputReleasePath, "utf8"));
if (builtManifest.artifactId !== manifest.artifactId) {
  throw new Error(
    `built release metadata mismatch: expected ${manifest.artifactId}, got ${builtManifest.artifactId}`,
  );
}
const probe = manifest.probes.items[0];
if (!probe) throw new Error("release metadata contains no item probes");

const overview = readFileSync(overviewPath, "utf8");
for (const snippet of [probe.name, "/assets/", "item-icon"]) {
  if (!overview.includes(snippet)) throw new Error(`overview HTML missing ${snippet}`);
}
for (const forbidden of ["_app/immutable/entry/app", "data.sqlite", "sqlite-wasm"]) {
  if (overview.includes(forbidden))
    throw new Error(`overview should not be a hydrated SQLite SPA: ${forbidden}`);
}

const detailPath = firstExisting([
  join(outputDir, "items", `${probe.id}.html`),
  join(outputDir, "items", probe.id, "index.html"),
]);
if (!detailPath) throw new Error(`missing prerendered detail page for ${probe.id}`);

const detail = readFileSync(detailPath, "utf8");
for (const snippet of [probe.name, "item-icon", "/assets/"]) {
  if (!detail.includes(snippet)) throw new Error(`detail HTML missing ${snippet}`);
}
if (detail.includes("_app/immutable/entry/app")) {
  throw new Error("detail page should not ship Svelte hydration entry by default");
}

if (probe.displayIconHash) {
  const assetPath = join(outputDir, "assets", `${probe.displayIconHash}.webp`);
  if (!existsSync(assetPath)) throw new Error(`missing probe asset: ${assetPath}`);
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}
