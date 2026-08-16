#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listingRoutePaths } from "../src/lib/server/sitemap-routes";

interface ReleaseProbe {
  id: string;
  name: string;
  canonicalSlug: string;
  displayIconHash: string | null;
}

interface ReleaseManifest {
  artifactId: string;
  artifactKind: "fixture" | "release";
  probes: { items: ReleaseProbe[] };
}

interface ArtifactMetadata {
  artifactId: string;
}

interface StatProbeRow {
  id: string;
  name: string;
  grouping: string;
  icon_hash: string;
  canonical_slug: string;
}

interface ItemCategoryProbeRow {
  id: string;
  name: string;
  asset_hash: string;
  canonical_slug: string;
  item_name: string;
}

interface ItemTagProbeRow {
  id: string;
  name: string;
  description: string;
  canonical_slug: string;
  item_name: string;
}

interface QuestProbeRow {
  id: string;
  name: string;
  canonical_slug: string;
  disabled: number;
}

interface CharacterProbeRow {
  id: string;
  name: string;
  canonical_slug: string;
  character_type_label: string | null;
  character_type_route_path: string | null;
}

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

const expectedRoutes = readExpectedRoutes();
const builtRoutes = readBuiltPageRoutes();
assertRouteParity(expectedRoutes, builtRoutes);
assertCharacterRouteCutover(builtRoutes);

const manifestValue: unknown = JSON.parse(readFileSync(releasePath, "utf8"));
const builtManifestValue: unknown = JSON.parse(readFileSync(outputReleasePath, "utf8"));
if (!isReleaseManifest(manifestValue)) {
  throw new Error("release metadata contains no item probes");
}
const manifest = manifestValue;
const builtManifest = isArtifactMetadata(builtManifestValue)
  ? builtManifestValue
  : { artifactId: undefined };
if (builtManifest.artifactId !== manifest.artifactId) {
  const builtArtifactId = isRecord(builtManifestValue) ? builtManifestValue.artifactId : undefined;
  throw new Error(
    `built release metadata mismatch: expected ${manifest.artifactId}, got ${String(builtArtifactId)}`,
  );
}
const probe = manifest.probes.items[0];
if (!probe) throw new Error("release metadata contains no item probes");

assertCharacterPageCopy(readCharacterProbes());

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
  join(outputDir, "items", `${probe.canonicalSlug}.html`),
  join(outputDir, "items", probe.canonicalSlug, "index.html"),
]);
if (!detailPath) throw new Error(`missing prerendered detail page for ${probe.canonicalSlug}`);

const detail = readFileSync(detailPath, "utf8");
for (const snippet of [probe.name, "item-icon", "/assets/"]) {
  if (!detail.includes(snippet)) throw new Error(`detail HTML missing ${snippet}`);
}
for (const [surface, html] of [
  ["overview", overview],
  ["detail", detail],
] as const) {
  // An icon that carries no alternative text repeats the name beside it, so it must
  // be hidden from a screen reader rather than announced as an unnamed graphic.
  const icons = [...html.matchAll(/<[a-z]+[^>]*\bitem-icon\b[^>]*>/g)].map((match) => match[0]);
  if (icons.length === 0) throw new Error(`${surface} HTML has no item icon element`);
  for (const icon of icons) {
    const alt = /\salt="([^"]*)"/.exec(icon);
    if (alt?.[1]) continue;
    if (!icon.includes('aria-hidden="true"')) {
      throw new Error(`${surface} item icon without alternative text must be aria-hidden: ${icon}`);
    }
  }
  // A title attribute is not reachable by keyboard or touch, so tooltip content
  // belongs in the page rather than in an attribute.
  const body = html.slice(html.indexOf("<body"));
  if (/\stitle="/.test(body)) {
    throw new Error(`${surface} HTML must not carry tooltip content in a title attribute`);
  }
}
if (detail.includes("_app/immutable/entry/app")) {
  throw new Error("detail page should not ship Svelte hydration entry by default");
}

if (probe.displayIconHash) {
  const assetPath = join(outputDir, "assets", `${probe.displayIconHash}.webp`);
  if (!existsSync(assetPath)) throw new Error(`missing probe asset: ${assetPath}`);
}

const disabledQuest = readQuestProbe(true);
if (disabledQuest.disabled !== 1) {
  throw new Error(`quest probe is not disabled: ${disabledQuest.id}`);
}
const disabledQuestPath = firstExisting([
  join(outputDir, "quests", `${disabledQuest.canonical_slug}.html`),
  join(outputDir, "quests", disabledQuest.canonical_slug, "index.html"),
]);
if (!disabledQuestPath) {
  throw new Error(`missing prerendered quest detail page for ${disabledQuest.id}`);
}
const disabledQuestDetail = readFileSync(disabledQuestPath, "utf8");
for (const snippet of [
  disabledQuest.name,
  'aria-label="Availability"',
  "The game has this quest disabled. Other content may still reference it.",
]) {
  if (!disabledQuestDetail.includes(snippet)) {
    throw new Error(`disabled quest detail HTML missing ${snippet}`);
  }
}

const availableQuest = readQuestProbe(false);
if (availableQuest.disabled !== 0) {
  throw new Error(`quest probe is disabled: ${availableQuest.id}`);
}
const availableQuestPath = firstExisting([
  join(outputDir, "quests", `${availableQuest.canonical_slug}.html`),
  join(outputDir, "quests", availableQuest.canonical_slug, "index.html"),
]);
if (!availableQuestPath) {
  throw new Error(`missing prerendered quest detail page for ${availableQuest.id}`);
}
const availableQuestDetail = readFileSync(availableQuestPath, "utf8");
if (availableQuestDetail.includes('aria-label="Availability"')) {
  throw new Error("available quest detail should not render an availability notice");
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

function readExpectedRoutes(): string[] {
  const db = new Database(join(import.meta.dirname, "..", ".data", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const rows = db
      .query<{ route_path: string }, []>(
        "SELECT route_path FROM entity_nodes WHERE has_page = 1 ORDER BY route_path",
      )
      .all();
    return [...new Set([...listingRoutePaths, ...rows.map((row) => row.route_path)])].sort();
  } finally {
    db.close();
  }
}

function readBuiltPageRoutes(): string[] {
  const routes = new Set<string>();
  const visit = (directory: string, segments: string[]) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(join(directory, entry.name), [...segments, entry.name]);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      const pageName = entry.name.slice(0, -".html".length);
      const pageSegments = pageName === "index" ? segments : [...segments, pageName];
      const route = pageSegments.length === 0 ? "/" : `/${pageSegments.join("/")}`;
      if (route !== "/404") routes.add(route);
    }
  };
  visit(outputDir, []);
  return [...routes].sort();
}

function assertCharacterRouteCutover(built: string[]): void {
  const builtSet = new Set(built);
  for (const route of ["/characters", "/character-types"]) {
    if (!builtSet.has(route)) throw new Error(`missing character route: ${route}`);
  }
  const legacyBase = "/placed-characters";
  const legacyRoutes = built.filter(
    (route) => route === legacyBase || route.startsWith(`${legacyBase}/`),
  );
  if (legacyRoutes.length > 0) {
    throw new Error(
      `legacy character routes remain in prerendered output: ${legacyRoutes.join(", ")}`,
    );
  }
}

function assertRouteParity(expected: string[], built: string[]): void {
  const builtSet = new Set(built);
  const expectedSet = new Set(expected);
  const missing = expected.filter((route) => !builtSet.has(route));
  if (missing.length > 0) {
    throw new Error(
      `missing prerendered pages for staged routes (${missing.length}): ${missing.join(", ")}`,
    );
  }
  const unexpected = built.filter((route) => !expectedSet.has(route));
  if (unexpected.length > 0) {
    throw new Error(
      `prerendered page files are not explained by the staged database (${unexpected.length}): ${unexpected.join(", ")}`,
    );
  }
}

function assertCharacterPageCopy(probes: {
  definition: CharacterProbeRow;
  race: CharacterProbeRow;
  none: CharacterProbeRow | null;
}): void {
  const typed = [probes.definition, probes.race];
  for (const probe of typed) {
    const path = firstExisting([
      join(outputDir, "characters", `${probe.canonical_slug}.html`),
      join(outputDir, "characters", probe.canonical_slug, "index.html"),
    ]);
    if (!path) throw new Error(`missing character probe page: ${probe.id}`);
    const html = readFileSync(path, "utf8");
    if (countOccurrences(html, "This character is identified as") !== 1) {
      throw new Error(`character type statement is not singular on ${probe.id}`);
    }
    if (!probe.character_type_label || !html.includes(probe.character_type_label)) {
      throw new Error(`character type label missing on ${probe.id}`);
    }
    if (probe.character_type_route_path && !html.includes(probe.character_type_route_path)) {
      throw new Error(`character type link missing on ${probe.id}`);
    }
  }

  if (!probes.none) return;
  const nonePath = firstExisting([
    join(outputDir, "characters", `${probes.none.canonical_slug}.html`),
    join(outputDir, "characters", probes.none.canonical_slug, "index.html"),
  ]);
  if (!nonePath) throw new Error(`missing character probe page: ${probes.none.id}`);
  const noneHtml = readFileSync(nonePath, "utf8");
  if (countOccurrences(noneHtml, "The game does not say what this character is.") !== 1) {
    throw new Error(`missing no-type statement on ${probes.none.id}`);
  }
}

function readCharacterProbes(): {
  definition: CharacterProbeRow;
  race: CharacterProbeRow;
  none: CharacterProbeRow | null;
} {
  const db = new Database(join(import.meta.dirname, "..", ".data", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const rows = db
      .query<CharacterProbeRow, []>(
        `SELECT p.id, p.name, n.canonical_slug,
                p.character_type_label, p.character_type_route_path
         FROM npc_presentation_rows p
         JOIN entity_nodes n
           ON n.entity_type = 'npc'
          AND n.entity_id = p.id
          AND n.has_page = 1
         ORDER BY p.name, p.id`,
      )
      .all();
    const definition = rows.find((row) =>
      row.character_type_route_path?.startsWith("/character-types/"),
    );
    const race = rows.find(
      (row) =>
        row.character_type_route_path !== null &&
        !row.character_type_route_path.startsWith("/character-types/"),
    );
    const none = rows.find((row) => row.character_type_route_path === null);
    if (!definition || !race) {
      throw new Error("staged artifact lacks a definition-typed or race-typed character probe");
    }
    if (!none && manifest.artifactKind === "fixture") {
      throw new Error("the synthetic fixture must keep a character whose type resolves to nothing");
    }
    return { definition, race, none: none ?? null };
  } finally {
    db.close();
  }
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

/**
 * Finds a quest by the state under test rather than by a fixture's id, so the same
 * smoke judges a synthetic artifact and a live export. The live game carries 16
 * disabled quests and 11 hidden from its quest UI.
 */
function readQuestProbe(disabled: boolean): QuestProbeRow {
  const db = new Database(join(import.meta.dirname, "..", ".data", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query<QuestProbeRow, [number]>(
        `SELECT p.id, p.name, p.disabled, n.canonical_slug
         FROM quest_presentation_rows p
         JOIN entity_nodes n
           ON n.entity_type = 'quest'
          AND n.entity_id = p.id
          AND n.has_page = 1
         WHERE p.disabled = ?
         ORDER BY p.name, p.id
         LIMIT 1`,
      )
      .get(disabled ? 1 : 0);
    if (!row) {
      throw new Error(
        `staged artifact contains no ${disabled ? "disabled" : "available"} quest to probe`,
      );
    }
    return row;
  } finally {
    db.close();
  }
}

function readStatProbe(): StatProbeRow {
  const db = new Database(join(import.meta.dirname, "..", ".data", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query<StatProbeRow, []>(
        `SELECT o.id, o.name, o.grouping, o.icon_hash, n.canonical_slug
         FROM stat_type_overview_rows o
         JOIN entity_nodes n
           ON n.entity_type = 'stat-type'
          AND n.entity_id = o.id
          AND n.has_page = 1
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

function readItemCategoryProbe(): ItemCategoryProbeRow {
  const db = new Database(join(import.meta.dirname, "..", ".data", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query<ItemCategoryProbeRow, []>(
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
          AND n.has_page = 1
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

function readItemTagProbe(): ItemTagProbeRow {
  const db = new Database(join(import.meta.dirname, "..", ".data", "data.sqlite"), {
    readonly: true,
    create: false,
  });
  try {
    const row = db
      .query<ItemTagProbeRow, []>(
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
          AND n.has_page = 1
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

function firstExisting(paths: string[]): string | null {
  return paths.find((path) => existsSync(path)) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isReleaseProbe(value: unknown): value is ReleaseProbe {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.canonicalSlug) &&
    isNullableString(value.displayIconHash)
  );
}

function isReleaseManifest(value: unknown): value is ReleaseManifest {
  if (!isRecord(value) || !isRecord(value.probes) || !isString(value.artifactId)) return false;
  if (value.artifactKind !== "fixture" && value.artifactKind !== "release") return false;
  return Array.isArray(value.probes.items) && value.probes.items.every(isReleaseProbe);
}

function isArtifactMetadata(value: unknown): value is ArtifactMetadata {
  return isRecord(value) && isString(value.artifactId);
}
