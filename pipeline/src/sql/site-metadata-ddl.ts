export const SITE_METADATA_DDL = `
CREATE TABLE site_entities (
  entity_id        TEXT PRIMARY KEY,
  singular_label   TEXT NOT NULL,
  plural_label     TEXT NOT NULL,
  route_path       TEXT NOT NULL
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
CREATE TABLE item_variants (
  variant_id           TEXT PRIMARY KEY,
  label                TEXT NOT NULL,
  unity_type           TEXT NOT NULL,
  canonical_table      TEXT NOT NULL,
  parent_variant_id    TEXT,
  position             INTEGER NOT NULL,
  has_page             INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE asset_refs (
  entity_id        TEXT NOT NULL,
  entity_row_id    TEXT NOT NULL,
  slot             TEXT NOT NULL,
  asset_kind       TEXT NOT NULL,
  asset_hash       TEXT NOT NULL,
  PRIMARY KEY (entity_id, entity_row_id, slot)
);
CREATE TABLE map_layers (
  layer_id             TEXT PRIMARY KEY,
  entity_id            TEXT NOT NULL,
  source_table          TEXT NOT NULL,
  source_tables_json    TEXT NOT NULL,
  render_kind           TEXT NOT NULL,
  icon                  TEXT,
  color_json            TEXT NOT NULL,
  radius                REAL,
  tooltip_fields_json   TEXT NOT NULL,
  filters_json          TEXT NOT NULL,
  legend_label          TEXT NOT NULL,
  z_order               INTEGER NOT NULL DEFAULT 0
);
`;
