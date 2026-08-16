export const NPC_DDL = `
CREATE TABLE npcs (
  id                       TEXT PRIMARY KEY,
  record_ref_json          TEXT NOT NULL,
  display_name             TEXT,
  authoring_label          TEXT,
  character_ref_json       TEXT,
  source_spawn_point_json  TEXT NOT NULL,
  map_id                   TEXT,
  drop_refs_json           TEXT NOT NULL,
  starting_level_json      TEXT,
  merchant_refs_json       TEXT NOT NULL,
  merchant_gold_json       TEXT,
  merchant_categories_json TEXT NOT NULL
);
CREATE TABLE npc_location_refs (
  id          TEXT PRIMARY KEY,
  npc_id      TEXT NOT NULL,
  location_id TEXT,
  ref_json    TEXT NOT NULL
);
CREATE TABLE npc_faction_refs (
  id                TEXT NOT NULL PRIMARY KEY,
  npc_id            TEXT NOT NULL,
  target_faction_id TEXT,
  ref_json          TEXT NOT NULL
);
CREATE TABLE npc_value_provenance (
  id         TEXT PRIMARY KEY,
  npc_id     TEXT NOT NULL,
  field_name TEXT NOT NULL,
  provenance TEXT NOT NULL,
  owner      TEXT
);
CREATE TABLE npc_presentation_rows (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  name_is_description     INTEGER NOT NULL,
  display_name_provenance TEXT NOT NULL,
  display_name_owner      TEXT,
  value_provenance_json    TEXT NOT NULL,
  render_context          TEXT NOT NULL,
  map_id            TEXT,
  map_x             REAL NOT NULL,
  map_y             REAL NOT NULL,
  elevation            REAL NOT NULL,
  location_ids_json    TEXT NOT NULL,
  character_type_id    TEXT,
  character_type_label TEXT,
  character_type_route_path TEXT
);
`;
