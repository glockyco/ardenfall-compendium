#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(import.meta.dirname, "..", ".svelte-kit", "cloudflare");
const sqlitePath = join(import.meta.dirname, "..", "static", "data.sqlite");
const overviewPath = firstExisting([
  join(outputDir, "items", "index.html"),
  join(outputDir, "items.html"),
]);

if (!overviewPath) {
  throw new Error(`missing prerendered item overview under ${outputDir}`);
}

const sample = readSampleItem(sqlitePath);
const overview = readFileSync(overviewPath, "utf8");
for (const snippet of [sample.name, "/assets/", "item-icon"]) {
  if (!overview.includes(snippet)) throw new Error(`overview HTML missing ${snippet}`);
}
for (const forbidden of ["_app/immutable/entry/app", "data.sqlite", "sqlite-wasm"]) {
  if (overview.includes(forbidden))
    throw new Error(`overview should not be a hydrated SQLite SPA: ${forbidden}`);
}

const detailPath = firstExisting([
  join(outputDir, "items", `${sample.id}.html`),
  join(outputDir, "items", sample.id, "index.html"),
]);
if (!detailPath) throw new Error(`missing prerendered detail page for ${sample.id}`);

const detail = readFileSync(detailPath, "utf8");
for (const snippet of [sample.name, "item-icon", "/assets/"]) {
  if (!detail.includes(snippet)) throw new Error(`detail HTML missing ${snippet}`);
}
if (detail.includes("_app/immutable/entry/app")) {
  throw new Error("detail page should not ship Svelte hydration entry by default");
}

function readSampleItem(path) {
  if (!existsSync(path)) throw new Error(`missing generated SQLite at ${path}`);
  const db = new Database(path, { readonly: true });
  try {
    const row = db
      .query(
        `SELECT id, name
         FROM item_overview_rows
         WHERE name IS NOT NULL AND display_icon_hash IS NOT NULL
         ORDER BY name
         LIMIT 1`,
      )
      .get();
    if (!row?.id || !row?.name) throw new Error("missing item overview row with display icon");
    return row;
  } finally {
    db.close();
  }
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}
