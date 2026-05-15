#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(import.meta.dirname, "..", ".svelte-kit", "cloudflare");
const overviewPath = firstExisting([
  join(outputDir, "items", "index.html"),
  join(outputDir, "items.html"),
]);

if (!overviewPath) {
  throw new Error(`missing prerendered item overview under ${outputDir}`);
}

const overview = readFileSync(overviewPath, "utf8");
for (const snippet of ["Iron Sword", "Leather Tunic", "/assets/", "item-icon"]) {
  if (!overview.includes(snippet)) throw new Error(`overview HTML missing ${snippet}`);
}
for (const forbidden of ["_app/immutable/entry/app", "data.sqlite", "sqlite-wasm"]) {
  if (overview.includes(forbidden))
    throw new Error(`overview should not be a hydrated SQLite SPA: ${forbidden}`);
}

const detailHtmlPaths = listHtml(join(outputDir, "items"));
for (const path of listHtml(outputDir)) {
  if (path.includes(`${join("items", "fixture-")}`) && !detailHtmlPaths.includes(path)) {
    detailHtmlPaths.push(path);
  }
}
if (detailHtmlPaths.length === 0) throw new Error("missing prerendered item detail pages");

const ironSwordPath = detailHtmlPaths.find((path) => path.includes("fixture-iron-sword"));
if (!ironSwordPath) throw new Error("missing fixture-iron-sword prerendered detail page");
const ironSword = readFileSync(ironSwordPath, "utf8");
for (const snippet of ["Iron Sword", "item-icon", "/assets/"]) {
  if (!ironSword.includes(snippet)) throw new Error(`detail HTML missing ${snippet}`);
}
if (ironSword.includes("_app/immutable/entry/app")) {
  throw new Error("detail page should not ship Svelte hydration entry by default");
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? null;
}
function listHtml(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = statSync(path);
    if (info.isDirectory()) results.push(...listHtml(path));
    else if (entry === "index.html" || entry.endsWith(".html")) results.push(path);
  }
  return results;
}
