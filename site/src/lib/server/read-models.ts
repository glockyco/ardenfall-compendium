import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const dbPath = () => join(process.cwd(), "static", "data.sqlite");
const require = createRequire(import.meta.url);

type SqlParams = readonly unknown[] | Record<string, unknown>;
type SqliteStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown | null;
};
type SqliteDatabase = {
  close: () => void;
  query?: (sql: string) => SqliteStatement;
  prepare?: (sql: string) => SqliteStatement;
};

let db: { path: string; handle: SqliteDatabase } | null = null;

const assetSrc = (hash: string | null): string | null => (hash ? `/assets/${hash}.webp` : null);

const colorCss = (json: string | null): string | null => {
  if (!json) return null;
  try {
    const color = JSON.parse(json) as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
    if (typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number") {
      return null;
    }
    const alpha = typeof color.a === "number" && Number.isFinite(color.a) ? color.a : 1;
    return `rgba(${colorChannel(color.r)}, ${colorChannel(color.g)}, ${colorChannel(color.b)}, ${alpha})`;
  } catch {
    return null;
  }
};

const colorChannel = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 255);

function getDb(): SqliteDatabase {
  const path = dbPath();
  if (db?.path !== path) {
    db?.handle.close();
    if (!existsSync(path)) throw new Error(`missing site SQLite database: ${path}`);
    db = { path, handle: openReadonlyDatabase(path) };
  }
  return db.handle;
}

function openReadonlyDatabase(path: string): SqliteDatabase {
  if ((process.versions as { bun?: string }).bun) {
    const { Database } = require("bun:sqlite") as {
      Database: new (
        filename: string,
        options: { readonly: boolean; create: boolean },
      ) => SqliteDatabase;
    };
    return new Database(path, { readonly: true, create: false });
  }

  const Database = require("better-sqlite3") as new (
    filename: string,
    options: { readonly: boolean; fileMustExist: boolean },
  ) => SqliteDatabase;
  return new Database(path, { readonly: true, fileMustExist: true });
}

function prepareStatement(sql: string): SqliteStatement {
  const database = getDb();
  if (database.query) return database.query(sql);
  if (database.prepare) return database.prepare(sql);
  throw new Error("unsupported SQLite database adapter");
}

function all<T>(sql: string, params: SqlParams = []): T[] {
  const query = prepareStatement(sql);
  return (Array.isArray(params) ? query.all(...params) : query.all(params)) as T[];
}

function get<T>(sql: string, params: SqlParams = []): T | undefined {
  const query = prepareStatement(sql);
  return (
    ((Array.isArray(params) ? query.get(...params) : query.get(params)) as T | null) ?? undefined
  );
}

export interface SiteEntity {
  entity_id: string;
  singular_label: string;
  plural_label: string;
  route_path: string;
  canonical_table: string;
}

export interface SiteOverviewColumn {
  entity_id: string;
  column_id: string;
  field_id: string;
  position: number;
  renderer: "text" | "itemNameWithIcon";
  sortable: number;
}

export interface SiteDetailSection {
  entity_id: string;
  section_id: string;
  kind: "fieldList" | "custom";
  title: string;
  position: number;
  renderer_key: string | null;
  payload_schema_version: number;
  payload_json: string | null;
}

export interface SiteDetailSectionField {
  entity_id: string;
  section_id: string;
  field_id: string;
  position: number;
}

export interface SiteEntityField {
  entity_id: string;
  field_id: string;
  source_table: string;
  source_column: string;
  label: string;
  value_kind: string;
  formatter: string | null;
  null_policy: string;
  link_target: string | null;
}

interface ItemOverviewRecord {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
}

interface ItemOverviewCategoryRecord {
  category_id: string;
  label: string;
  href: string;
  item_count: number;
  sort_order: number;
}

interface ItemOverviewFilterRecord {
  filter_id: string;
  label: string;
  kind: "multi-select";
  options_json: string;
}

interface ItemPresentationRecord {
  id: string;
  name: string | null;
  variant: string | null;
  item_type: string | null;
  render_context: "item-presentation-v1";
  display_icon_hash: string | null;
  display_icon_color: string | null;
  description_source: string;
  description_rich_text_json: string;
  effects_source: string;
  effects_source_rich_text_json: string;
  effect_facts_json: string;
  stat_rows_json: string;
  requirements_json: string;
  durability_json: string | null;
  state_facts_json: string;
  omissions_json: string;
  value: number | null;
  weight: number | null;
  diagnostics_json: string;
}

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
  tooltip: ItemPresentationRow | undefined;
}

export interface ItemPresentationRow {
  id: string;
  name: string | null;
  variant: string | null;
  itemType: string | null;
  renderContext: "item-presentation-v1";
  displayIconSrc: string | null;
  displayIconColor: string | null;
  description: RichTextDocument;
  effectsSource: string;
  effectsSourceRichText: RichTextDocument;
  effects: ItemPresentationEffect[];
  statRows: ItemPresentationStatRow[];
  requirements: ItemPresentationRequirement[];
  durability: ItemPresentationDurability | null;
  stateFacts: ItemPresentationStateFact[];
  omissions: ItemPresentationOmission[];
  value: number | null;
  weight: number | null;
  diagnostics: ItemPresentationDiagnostic[];
}

export interface RichTextDocument {
  schemaVersion: 1;
  sourceHash: string;
  nodes: RichTextNode[];
  diagnostics: ItemPresentationDiagnostic[];
}

export type RichTextNode =
  | { type: "text"; text: string }
  | { type: "lineBreak" }
  | { type: "strong" | "emphasis" | "strike"; children: RichTextNode[] }
  | { type: "color"; token: string | null; color: string | null; children: RichTextNode[] }
  | { type: "sprite"; name: string }
  | {
      type: "termLink";
      termId: string;
      label: string;
      targetType?: string;
      targetId?: string;
      targetLabel?: string;
      targetRoutePath?: string;
      targetIsPublic?: boolean;
    };

export interface ItemPresentationStatRow {
  id: string;
  label: string;
  value: number | null;
  valueText: string;
  suffix: string | null;
  size: string;
  indent: number;
  comparison: string | null;
  source: string;
}

export interface ItemPresentationRequirement {
  id: string;
  label: string;
  valueText: string;
  source: string;
}

export interface ItemPresentationEffect {
  kind: string;
  label: string;
  targetType: string | null;
  targetId: string | null;
  source: string;
}

export interface ItemPresentationDurability {
  kind: string;
  max: number;
  source: string;
}

export interface ItemPresentationStateFact {
  kind: string;
  label: string;
  description: string;
}

export interface ItemPresentationOmission {
  code: string;
  severity: "diagnostic";
  message: string;
}

export interface ItemPresentationDiagnostic {
  severity: "fatal" | "diagnostic";
  code: string;
  field: string;
  message: string;
}

export interface RelationshipSection {
  id: string;
  title: string;
  predicate: string;
  edges: RelationshipEdge[];
}

export interface RelationshipEdge {
  targetType: string;
  targetId: string;
  targetLabel: string;
  targetRoutePath: string;
  predicate: string;
  label: string;
  weight: number;
  anchor: string | null;
}

export interface ItemOverviewCategory {
  id: string;
  label: string;
  href: string;
  itemCount: number;
}

export interface ItemOverviewFilter {
  id: string;
  label: string;
  kind: "multi-select";
  options: { value: string; label: string; count: number }[];
}

export interface EntityNode {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string;
}

export interface EntityNodeRow {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string;
  canonicalSlug: string;
  shortId: string;
  isPublic: boolean;
}

interface StatTypeOverviewRecord {
  id: string;
  name: string;
  grouping: "attribute" | "skill" | "trait";
  icon_hash: string | null;
  icon_color: string | null;
  route_path: string;
}

interface StatTypePresentationRecord {
  id: string;
  name: string;
  grouping: "attribute" | "skill" | "trait";
  render_context: "stat-type-presentation-v1";
  icon_hash: string | null;
  icon_color: string | null;
  description: string | null;
  long_description: string | null;
  affects_json: string;
  skill_affects_json: string;
}

interface ItemCategoryOverviewRecord {
  id: string;
  name: string;
  icon_hash: string | null;
  default_item_icon_hash: string | null;
  category_color_json: string;
  item_count: number;
  route_path: string;
}

interface ItemCategoryPresentationRecord {
  id: string;
  name: string;
  render_context: "item-category-presentation-v1";
  icon_hash: string | null;
  default_item_icon_hash: string | null;
  category_color_json: string;
  show_in_all_category: number;
  columns_json: string;
  item_count: number;
}

interface ItemTagOverviewRecord {
  id: string;
  name: string;
  description: string;
  item_count: number;
  route_path: string;
}

interface ItemTagPresentationRecord {
  id: string;
  name: string;
  render_context: "item-tag-presentation-v1";
  description: string;
  item_count: number;
}

export interface StatTypeOverviewRow {
  id: string;
  name: string;
  grouping: "attribute" | "skill" | "trait";
  iconSrc: string | null;
  iconColor: string | null;
  routePath: string;
}

export interface StatTypePresentationRow {
  id: string;
  name: string;
  grouping: "attribute" | "skill" | "trait";
  renderContext: "stat-type-presentation-v1";
  iconSrc: string | null;
  iconColor: string | null;
  description: string | null;
  longDescription: string | null;
  affects: string[];
  skillAffects: string[];
}

export interface ItemCategoryOverviewRow {
  id: string;
  name: string;
  iconSrc: string | null;
  defaultItemIconSrc: string | null;
  categoryColor: string;
  itemCount: number;
  routePath: string;
}

export interface ItemCategoryPresentationRow {
  id: string;
  name: string;
  renderContext: "item-category-presentation-v1";
  iconSrc: string | null;
  defaultItemIconSrc: string | null;
  categoryColor: string;
  showInAllCategory: boolean;
  columns: Record<string, unknown>[];
  itemCount: number;
}

export interface ItemTagOverviewRow {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  routePath: string;
}

export interface ItemTagPresentationRow {
  id: string;
  name: string;
  renderContext: "item-tag-presentation-v1";
  description: string;
  itemCount: number;
}

export const getEntity = (id: string): SiteEntity | undefined =>
  get<SiteEntity>("SELECT * FROM site_entities WHERE entity_id = ?", [id]);

export const listOverviewColumns = (id: string): SiteOverviewColumn[] =>
  all<SiteOverviewColumn>(
    "SELECT * FROM site_overview_columns WHERE entity_id = ? ORDER BY position",
    [id],
  );

export const listDetailSections = (id: string): SiteDetailSection[] =>
  all<SiteDetailSection>(
    "SELECT * FROM site_detail_sections WHERE entity_id = ? ORDER BY position",
    [id],
  );

export const listSectionFields = (entityId: string, sectionId: string): SiteDetailSectionField[] =>
  all<SiteDetailSectionField>(
    "SELECT * FROM site_detail_section_fields WHERE entity_id = ? AND section_id = ? ORDER BY position",
    [entityId, sectionId],
  );

export const getEntityField = (entityId: string, fieldId: string): SiteEntityField | undefined =>
  get<SiteEntityField>("SELECT * FROM site_entity_fields WHERE entity_id = ? AND field_id = ?", [
    entityId,
    fieldId,
  ]);

const toItemPresentationRow = (row: ItemPresentationRecord): ItemPresentationRow => ({
  id: row.id,
  name: row.name,
  variant: row.variant,
  itemType: row.item_type,
  renderContext: row.render_context,
  displayIconSrc: assetSrc(row.display_icon_hash),
  displayIconColor: row.display_icon_color,
  description: JSON.parse(row.description_rich_text_json) as RichTextDocument,
  effectsSource: row.effects_source,
  effectsSourceRichText: JSON.parse(row.effects_source_rich_text_json) as RichTextDocument,
  effects: JSON.parse(row.effect_facts_json) as ItemPresentationEffect[],
  statRows: JSON.parse(row.stat_rows_json) as ItemPresentationStatRow[],
  requirements: JSON.parse(row.requirements_json) as ItemPresentationRequirement[],
  durability: row.durability_json
    ? (JSON.parse(row.durability_json) as ItemPresentationDurability)
    : null,
  stateFacts: JSON.parse(row.state_facts_json) as ItemPresentationStateFact[],
  omissions: JSON.parse(row.omissions_json) as ItemPresentationOmission[],
  value: row.value,
  weight: row.weight,
  diagnostics: JSON.parse(row.diagnostics_json) as ItemPresentationDiagnostic[],
});

const attachItemTooltips = (rows: ItemOverviewRecord[]): ItemOverviewRow[] => {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(", ");
  const presentations = new Map(
    all<ItemPresentationRecord>(
      `SELECT * FROM item_presentation_rows WHERE id IN (${placeholders})`,
      ids,
    ).map((row) => [row.id, toItemPresentationRow(row)]),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weight: row.weight,
    value: row.value,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
    tooltip: presentations.get(row.id),
  }));
};

export const listItemsOverview = (): ItemOverviewRow[] =>
  attachItemTooltips(all<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name"));

export const listItemsByVariant = (variant: string): ItemOverviewRow[] =>
  attachItemTooltips(
    all<ItemOverviewRecord>("SELECT * FROM item_overview_rows WHERE variant = ? ORDER BY name", [
      variant,
    ]),
  );

export const listItemsByCategory = (categoryId: string): ItemOverviewRow[] =>
  attachItemTooltips(
    all<ItemOverviewRecord>(
      `SELECT o.id, o.name, o.weight, o.value, o.variant, o.display_icon_hash, o.display_icon_color
       FROM item_overview_rows o
       JOIN items i ON i.id = o.id
       WHERE json_extract(i."categoryRef", '$.guid') = ?
       ORDER BY o.name`,
      [categoryId],
    ),
  );

export const listItemsByTag = (tagId: string): ItemOverviewRow[] =>
  attachItemTooltips(
    all<ItemOverviewRecord>(
      `SELECT o.id, o.name, o.weight, o.value, o.variant, o.display_icon_hash, o.display_icon_color
       FROM item_overview_rows o
       JOIN item_tag_refs refs ON refs.item_id = o.id
       WHERE refs.tag = ?
       ORDER BY o.name`,
      [tagId],
    ),
  );

export const listItemOverviewCategories = (): ItemOverviewCategory[] =>
  all<ItemOverviewCategoryRecord>(
    "SELECT * FROM item_overview_categories ORDER BY sort_order, label",
  ).map((row) => ({
    id: row.category_id,
    label: row.label,
    href: row.href,
    itemCount: row.item_count,
  }));

export const listItemOverviewFilters = (): ItemOverviewFilter[] =>
  all<ItemOverviewFilterRecord>("SELECT * FROM item_overview_filters ORDER BY filter_id").map(
    (row) => ({
      id: row.filter_id,
      label: row.label,
      kind: row.kind,
      options: JSON.parse(row.options_json) as ItemOverviewFilter["options"],
    }),
  );

export const listItemIds = (): string[] =>
  all<{ id: string }>("SELECT id FROM item_presentation_rows ORDER BY id").map((row) => row.id);

export const getItemPresentation = (id: string): ItemPresentationRow | undefined => {
  const row = get<ItemPresentationRecord>("SELECT * FROM item_presentation_rows WHERE id = ?", [
    id,
  ]);
  return row ? toItemPresentationRow(row) : undefined;
};

export const listRelationshipSections = (
  sourceType: string,
  sourceId: string,
): RelationshipSection[] =>
  all<{
    section_id: string;
    title: string;
    predicate: string;
    edges_json: string;
  }>(
    "SELECT section_id, title, predicate, edges_json FROM entity_relationship_sections WHERE source_type = ? AND source_id = ? ORDER BY sort_order, title",
    [sourceType, sourceId],
  ).map((row) => ({
    id: row.section_id,
    title: row.title,
    predicate: row.predicate,
    edges: JSON.parse(row.edges_json) as RelationshipEdge[],
  }));

export const listTermIds = (): string[] =>
  all<{ entity_id: string }>(
    "SELECT entity_id FROM entity_nodes WHERE entity_type = 'term' AND is_public = 1 ORDER BY entity_id",
  ).map((row) => row.entity_id);

export const getTerm = (id: string): EntityNode | undefined => {
  const row = get<{
    entity_type: string;
    entity_id: string;
    label: string;
    route_path: string;
  }>(
    "SELECT entity_type, entity_id, label, route_path FROM entity_nodes WHERE entity_type = 'term' AND entity_id = ? AND is_public = 1",
    [id],
  );
  if (!row) return undefined;
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    label: row.label,
    routePath: row.route_path,
  };
};

export const getEntityNodeBySlug = (
  entityType: string,
  canonicalSlug: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, is_public AS isPublic
     FROM entity_nodes
     WHERE entity_type = ? AND canonical_slug = ? AND is_public = 1`,
    [entityType, canonicalSlug],
  );

export const getEntityNodeByShortId = (
  entityType: string,
  shortId: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, is_public AS isPublic
     FROM entity_nodes
     WHERE entity_type = ? AND short_id = ? AND is_public = 1`,
    [entityType, shortId],
  );

export const listStatTypes = (): StatTypeOverviewRow[] =>
  all<StatTypeOverviewRecord>(
    `SELECT o.id, o.name, o.grouping, o.icon_hash, o.icon_color, n.route_path
     FROM stat_type_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'stat-type'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.grouping, o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    grouping: row.grouping,
    iconSrc: assetSrc(row.icon_hash),
    iconColor: colorCss(row.icon_color),
    routePath: row.route_path,
  }));

export const getStatTypePresentation = (slug: string): StatTypePresentationRow | undefined => {
  const node = getEntityNodeBySlug("stat-type", slug);
  if (!node) return undefined;
  const row = get<StatTypePresentationRecord>(
    `SELECT id, name, grouping, render_context, icon_hash, icon_color,
            description, long_description, affects_json, skill_affects_json
     FROM stat_type_presentation_rows
     WHERE id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    grouping: row.grouping,
    renderContext: row.render_context,
    iconSrc: assetSrc(row.icon_hash),
    iconColor: colorCss(row.icon_color),
    description: row.description,
    longDescription: row.long_description,
    affects: JSON.parse(row.affects_json) as string[],
    skillAffects: JSON.parse(row.skill_affects_json) as string[],
  };
};

export const listItemCategories = (): ItemCategoryOverviewRow[] =>
  all<ItemCategoryOverviewRecord>(
    `SELECT o.id, o.name, o.icon_hash, o.default_item_icon_hash,
            o.category_color_json, o.item_count, n.route_path
     FROM item_category_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'item-category'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    iconSrc: assetSrc(row.icon_hash),
    defaultItemIconSrc: assetSrc(row.default_item_icon_hash),
    categoryColor: row.category_color_json,
    itemCount: row.item_count,
    routePath: row.route_path,
  }));

export const getItemCategoryPresentation = (
  slug: string,
): ItemCategoryPresentationRow | undefined => {
  const node = getEntityNodeBySlug("item-category", slug);
  if (!node) return undefined;
  const row = get<ItemCategoryPresentationRecord>(
    `SELECT id, name, render_context, icon_hash, default_item_icon_hash,
            category_color_json, show_in_all_category, columns_json, item_count
     FROM item_category_presentation_rows
     WHERE id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    renderContext: row.render_context,
    iconSrc: assetSrc(row.icon_hash),
    defaultItemIconSrc: assetSrc(row.default_item_icon_hash),
    categoryColor: row.category_color_json,
    showInAllCategory: row.show_in_all_category === 1,
    columns: JSON.parse(row.columns_json) as Record<string, unknown>[],
    itemCount: row.item_count,
  };
};

export const listItemTags = (): ItemTagOverviewRow[] =>
  all<ItemTagOverviewRecord>(
    `SELECT o.id, o.name, o.description, o.item_count, n.route_path
     FROM item_tag_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'item-tag'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.item_count,
    routePath: row.route_path,
  }));

export const getItemTagPresentation = (slug: string): ItemTagPresentationRow | undefined => {
  const node = getEntityNodeBySlug("item-tag", slug);
  if (!node) return undefined;
  const row = get<ItemTagPresentationRecord>(
    `SELECT id, name, render_context, description, item_count
     FROM item_tag_presentation_rows
     WHERE id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    renderContext: row.render_context,
    description: row.description,
    itemCount: row.item_count,
  };
};
