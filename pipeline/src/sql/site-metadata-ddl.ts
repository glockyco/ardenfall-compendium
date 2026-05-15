export const SITE_METADATA_DDL = `
CREATE TABLE site_entities (
  entity_id        TEXT PRIMARY KEY,
  singular_label   TEXT NOT NULL,
  plural_label     TEXT NOT NULL,
  route_path       TEXT NOT NULL,
  canonical_table  TEXT NOT NULL
);
CREATE TABLE site_entity_fields (
  entity_id        TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  source_table     TEXT NOT NULL,
  source_column    TEXT NOT NULL,
  label            TEXT NOT NULL,
  value_kind       TEXT NOT NULL,
  formatter        TEXT,
  null_policy      TEXT NOT NULL,
  link_target      TEXT,
  PRIMARY KEY (entity_id, field_id)
);
CREATE TABLE site_overview_columns (
  entity_id        TEXT NOT NULL,
  column_id        TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  position         INTEGER NOT NULL,
  renderer         TEXT NOT NULL DEFAULT 'text',
  sortable         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_id, column_id)
);
CREATE TABLE site_detail_sections (
  entity_id                TEXT NOT NULL,
  section_id               TEXT NOT NULL,
  kind                     TEXT NOT NULL,
  title                    TEXT NOT NULL,
  position                 INTEGER NOT NULL,
  renderer_key             TEXT,
  payload_schema_version   INTEGER NOT NULL DEFAULT 1,
  payload_json             TEXT,
  PRIMARY KEY (entity_id, section_id)
);
CREATE TABLE site_detail_section_fields (
  entity_id        TEXT NOT NULL,
  section_id       TEXT NOT NULL,
  field_id         TEXT NOT NULL,
  position         INTEGER NOT NULL,
  PRIMARY KEY (entity_id, section_id, field_id)
);
CREATE TABLE item_variants (
  variant_id           TEXT PRIMARY KEY,
  label                TEXT NOT NULL,
  unity_type           TEXT NOT NULL,
  canonical_table      TEXT NOT NULL,
  parent_variant_id    TEXT,
  position             INTEGER NOT NULL,
  is_public_route      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE site_read_models (
  read_model_id    TEXT PRIMARY KEY,
  physical_name    TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  purpose          TEXT NOT NULL
);
CREATE TABLE asset_refs (
  entity_id        TEXT NOT NULL,
  entity_row_id    TEXT NOT NULL,
  slot             TEXT NOT NULL,
  asset_kind       TEXT NOT NULL,
  asset_hash       TEXT NOT NULL,
  PRIMARY KEY (entity_id, entity_row_id, slot)
);
`;
