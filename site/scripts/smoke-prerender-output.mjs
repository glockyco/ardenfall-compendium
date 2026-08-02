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
const statIconPath = join(outputDir, "assets", `${statProbe.icon_hash}.webp`);
if (!existsSync(statIconPath)) throw new Error(`missing stat probe asset: ${statIconPath}`);
const statsOverviewPath = firstExisting([
  join(outputDir, "stats", "index.html"),
  join(outputDir, "stats.html"),
]);
if (!statsOverviewPath) throw new Error(`missing prerendered stat overview under ${outputDir}`);
const statsOverview = readFileSync(statsOverviewPath, "utf8");
for (const snippet of ["Stats", statProbe.name, statProbe.grouping]) {
  if (!statsOverview.includes(snippet)) throw new Error(`stat overview HTML missing ${snippet}`);
}
if (!statsOverview.includes(`/assets/${statProbe.icon_hash}.webp`)) {
  throw new Error(`stat overview HTML missing icon asset ${statProbe.icon_hash}`);
}
const statsDetailPath = firstExisting([
  join(outputDir, "stats", `${statProbe.canonical_slug}.html`),
  join(outputDir, "stats", statProbe.canonical_slug, "index.html"),
]);
if (!statsDetailPath) throw new Error(`missing prerendered stat detail page for ${statProbe.id}`);
const statsDetail = readFileSync(statsDetailPath, "utf8");
for (const snippet of [statProbe.name, statProbe.grouping]) {
  if (!statsDetail.includes(snippet)) throw new Error(`stat detail HTML missing ${snippet}`);
}
if (statsDetail.includes("background-color: {")) {
  throw new Error("stat detail rendered raw JSON as CSS color");
}
if (!statsDetail.includes(`/assets/${statProbe.icon_hash}.webp`)) {
  throw new Error(`stat detail HTML missing icon asset ${statProbe.icon_hash}`);
}

const categoryProbe = readItemCategoryProbe();
const categoryAssetPath = join(outputDir, "assets", `${categoryProbe.asset_hash}.webp`);
if (!existsSync(categoryAssetPath)) {
  throw new Error(`missing category probe asset: ${categoryAssetPath}`);
}
const categoriesOverviewPath = firstExisting([
  join(outputDir, "categories", "index.html"),
  join(outputDir, "categories.html"),
]);
if (!categoriesOverviewPath) {
  throw new Error(`missing prerendered category overview under ${outputDir}`);
}
const categoriesOverview = readFileSync(categoriesOverviewPath, "utf8");
for (const snippet of [
  "Categories",
  categoryProbe.name,
  `/assets/${categoryProbe.asset_hash}.webp`,
]) {
  if (!categoriesOverview.includes(snippet)) {
    throw new Error(`category overview HTML missing ${snippet}`);
  }
}
const categoryDetailPath = firstExisting([
  join(outputDir, "categories", `${categoryProbe.canonical_slug}.html`),
  join(outputDir, "categories", categoryProbe.canonical_slug, "index.html"),
]);
if (!categoryDetailPath) {
  throw new Error(`missing prerendered category detail page for ${categoryProbe.id}`);
}
const categoryDetail = readFileSync(categoryDetailPath, "utf8");
for (const snippet of [categoryProbe.name, `/assets/${categoryProbe.asset_hash}.webp`]) {
  if (!categoryDetail.includes(snippet)) {
    throw new Error(`category detail HTML missing ${snippet}`);
  }
}
if (!categoryDetail.includes(categoryProbe.item_name)) {
  throw new Error(`category detail HTML missing item ${categoryProbe.item_name}`);
}

const tagProbe = readItemTagProbe();
const tagsOverviewPath = firstExisting([
  join(outputDir, "tags", "index.html"),
  join(outputDir, "tags.html"),
]);
if (!tagsOverviewPath) {
  throw new Error(`missing prerendered tag overview under ${outputDir}`);
}
const tagsOverview = readFileSync(tagsOverviewPath, "utf8");
for (const snippet of ["Tags", tagProbe.name, tagProbe.description]) {
  if (!tagsOverview.includes(snippet)) {
    throw new Error(`tag overview HTML missing ${snippet}`);
  }
}
const tagDetailPath = firstExisting([
  join(outputDir, "tags", `${tagProbe.canonical_slug}.html`),
  join(outputDir, "tags", tagProbe.canonical_slug, "index.html"),
]);
if (!tagDetailPath) {
  throw new Error(`missing prerendered tag detail page for ${tagProbe.id}`);
}
const tagDetail = readFileSync(tagDetailPath, "utf8");
for (const snippet of [tagProbe.name, tagProbe.description]) {
  if (!tagDetail.includes(snippet)) {
    throw new Error(`tag detail HTML missing ${snippet}`);
  }
}
if (!tagDetail.includes(tagProbe.item_name)) {
  throw new Error(`tag detail HTML missing item ${tagProbe.item_name}`);
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
         WHERE o.icon_hash IS NOT NULL
         ORDER BY o.grouping, o.name
         LIMIT 1`,
      )
      .get();
    if (!row) throw new Error("staged artifact contains no icon-bearing stat-type probe");
    return row;
  } finally {
    db.close();
  }
}

function readItemCategoryProbe() {
  const db = new Database(join(import.meta.dirname, "..", "static", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query(
        `SELECT o.id, o.name, COALESCE(o.icon_hash, o.default_item_icon_hash) AS asset_hash,
                n.canonical_slug,
                (
                  SELECT COALESCE(io.name, io.id)
                  FROM item_overview_rows io
                  JOIN items i ON i.id = io.id
                  WHERE 'named;'
                        || json_extract(i."categoryRef", '$.entity')
                        || ';'
                        || json_extract(i."categoryRef", '$.name') = o.id
                  ORDER BY io.name, io.id
                  LIMIT 1
                ) AS item_name
         FROM item_category_overview_rows o
         JOIN entity_nodes n
           ON n.entity_type = 'item-category'
          AND n.entity_id = o.id
          AND n.is_public = 1
         WHERE COALESCE(o.icon_hash, o.default_item_icon_hash) IS NOT NULL
           AND o.item_count > 0
         ORDER BY o.name
         LIMIT 1`,
      )
      .get();
    if (!row?.item_name)
      throw new Error("staged artifact contains no icon-bearing item-category probe");
    return row;
  } finally {
    db.close();
  }
}

function readItemTagProbe() {
  const db = new Database(join(import.meta.dirname, "..", "static", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query(
        `SELECT o.id, o.name, o.description, n.canonical_slug,
                (
                  SELECT COALESCE(io.name, io.id)
                  FROM item_overview_rows io
                  JOIN item_tag_refs refs ON refs.item_id = io.id
                  WHERE refs.tag = o.id
                  ORDER BY io.name, io.id
                  LIMIT 1
                ) AS item_name
         FROM item_tag_overview_rows o
         JOIN entity_nodes n
           ON n.entity_type = 'item-tag'
          AND n.entity_id = o.id
          AND n.is_public = 1
         WHERE o.item_count > 0
         ORDER BY o.name
         LIMIT 1`,
      )
      .get();
    if (!row?.item_name) throw new Error("staged artifact contains no item-tag probe");
    return row;
  } finally {
    db.close();
  }
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}
