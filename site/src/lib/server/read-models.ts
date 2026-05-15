import Database from "better-sqlite3";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), "static", "data.sqlite");

let db: Database.Database | null = null;

type SqlParams = readonly unknown[] | Record<string, unknown>;

const assetSrc = (hash: string | null): string | null => (hash ? `/assets/${hash}.webp` : null);

function getDb(): Database.Database {
  db ??= new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return db;
}

function all<T>(sql: string, params: SqlParams = []): T[] {
  return getDb()
    .prepare(sql)
    .all(...(Array.isArray(params) ? params : [params])) as T[];
}

function get<T>(sql: string, params: SqlParams = []): T | undefined {
  return getDb()
    .prepare(sql)
    .get(...(Array.isArray(params) ? params : [params])) as T | undefined;
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

interface ItemDetailRecord {
  id: string;
  name: string | null;
  variant: string | null;
  display_icon_hash: string | null;
  display_icon_color: string | null;
  fields_json: string;
}

export interface ItemOverviewRow {
  id: string;
  name: string | null;
  weight: number | null;
  value: number | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
}

export interface ItemDetailRow {
  id: string;
  name: string | null;
  variant: string | null;
  displayIconSrc: string | null;
  displayIconColor: string | null;
  fields_json: string;
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

export const listItemsOverview = (): ItemOverviewRow[] =>
  all<ItemOverviewRecord>("SELECT * FROM item_overview_rows ORDER BY name").map((row) => ({
    id: row.id,
    name: row.name,
    weight: row.weight,
    value: row.value,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
  }));

export const listItemIds = (): string[] =>
  all<{ id: string }>("SELECT id FROM item_detail_rows ORDER BY id").map((row) => row.id);

export const getItemDetail = (id: string): ItemDetailRow | undefined => {
  const row = get<ItemDetailRecord>("SELECT * FROM item_detail_rows WHERE id = ?", [id]);
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    variant: row.variant,
    displayIconSrc: assetSrc(row.display_icon_hash),
    displayIconColor: row.display_icon_color,
    fields_json: row.fields_json,
  };
};
