#!/usr/bin/env bun
import { Database } from "bun:sqlite";
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
for (const forbidden of ["data.sqlite", "sqlite-wasm"]) {
  if (overview.includes(forbidden))
    throw new Error(`overview should not be a hydrated SQLite SPA: ${forbidden}`);
}
if (overview.includes("_app/immutable/entry/app")) {
  const csrOptIn = readFileSync(
    join(import.meta.dirname, "..", "src", "routes", "items", "+page.ts"),
    "utf8",
  );
  if (!csrOptIn.includes("export const csr = true")) {
    throw new Error("overview hydration requires an explicit /items CSR opt-in.");
  }
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

const statProbe = readStatProbe();
const statsOverviewPath = firstExisting([
  join(outputDir, "stats", "index.html"),
  join(outputDir, "stats.html"),
]);
if (!statsOverviewPath) throw new Error(`missing prerendered stat overview under ${outputDir}`);
const statsOverview = readFileSync(statsOverviewPath, "utf8");
for (const snippet of ["Stats", statProbe.name, statProbe.grouping]) {
  if (!statsOverview.includes(snippet)) throw new Error(`stat overview HTML missing ${snippet}`);
}
const statsDetailPath = firstExisting([
  join(outputDir, "stats", `${statProbe.canonical_slug}.html`),
  join(outputDir, "stats", statProbe.canonical_slug, "index.html"),
]);
if (!statsDetailPath) throw new Error(`missing prerendered stat detail page for ${statProbe.id}`);
const statsDetail = readFileSync(statsDetailPath, "utf8");
for (const snippet of [statProbe.name, statProbe.grouping, "melee-damage"]) {
  if (!statsDetail.includes(snippet)) throw new Error(`stat detail HTML missing ${snippet}`);
}
if (statsDetail.includes("background-color: {")) {
  throw new Error("stat detail rendered raw JSON as CSS color");
}
if (statProbe.icon_hash && !statsDetail.includes(`/assets/${statProbe.icon_hash}.webp`)) {
  throw new Error(`stat detail HTML missing icon asset ${statProbe.icon_hash}`);
}

function readStatProbe() {
  const db = new Database(join(import.meta.dirname, "..", "static", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query(
        `SELECT o.id, o.name, o.grouping, o.icon_hash, n.canonical_slug
         FROM stat_type_overview_rows o
         JOIN entity_nodes n
           ON n.entity_type = 'stat-type'
          AND n.entity_id = o.id
          AND n.is_public = 1
         ORDER BY o.grouping, o.name
         LIMIT 1`,
      )
      .get();
    if (!row) throw new Error("staged artifact contains no stat-type probe");
    return row;
  } finally {
    db.close();
  }
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}
