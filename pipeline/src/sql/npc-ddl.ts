export const NPC_DDL = `
CREATE TABLE npcs (
  id                       TEXT PRIMARY KEY,
  record_ref_json          TEXT NOT NULL,
  display_name             TEXT,
  display_name_provenance  TEXT NOT NULL,
  display_name_owner       TEXT,
  authoring_label          TEXT,
  character_ref_json       TEXT,
  source_spawn_point_json  TEXT NOT NULL,
  map_id                   TEXT
);
CREATE TABLE npc_location_refs (
  id          TEXT PRIMARY KEY,
  npc_id      TEXT NOT NULL,
  location_id TEXT,
  ref_json    TEXT NOT NULL
);
CREATE TABLE npc_presentation_rows (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  display_name_provenance TEXT NOT NULL,
  display_name_owner      TEXT,
  render_context          TEXT NOT NULL,
  map_id            TEXT,
  map_x             REAL NOT NULL,
  map_y             REAL NOT NULL,
  elevation         REAL NOT NULL,
  location_ids_json TEXT NOT NULL
);
`;
