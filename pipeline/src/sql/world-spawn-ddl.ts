export const WORLD_SPAWN_DDL = `
CREATE TABLE world_spawns (
  id                    TEXT PRIMARY KEY NOT NULL,
  cell                  TEXT NOT NULL,
  map_id                TEXT,
  source_position_json  TEXT NOT NULL,
  kind                  TEXT NOT NULL,
  character_ref_json    TEXT,
  record_ref_json       TEXT
);
-- How the authored scenes reach a character definition. Written after the graph exists, because
-- it reads the placement and spawner edges rather than recomputing them.
CREATE TABLE character_world_reach (
  character_id  TEXT PRIMARY KEY NOT NULL,
  reach         TEXT NOT NULL
);
CREATE TABLE world_spawn_presentation_rows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  render_context  TEXT NOT NULL,
  cell            TEXT NOT NULL,
  map_id          TEXT,
  map_x           REAL,
  map_y           REAL,
  elevation       REAL,
  kind            TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  target_name     TEXT
);
`;
