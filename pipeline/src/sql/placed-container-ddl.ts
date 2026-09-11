export const PLACED_CONTAINER_DDL = `
CREATE TABLE placed_containers (
  id                     TEXT PRIMARY KEY NOT NULL,
  cell                   TEXT NOT NULL,
  map_id                 TEXT,
  source_position_json   TEXT NOT NULL,
  container_name         TEXT NOT NULL,
  interaction_text       TEXT NOT NULL,
  loot_lists_json        TEXT NOT NULL,
  additional_items_json  TEXT NOT NULL,
  possible_item_refs_json TEXT NOT NULL,
  level_json             TEXT NOT NULL,
  lock_json              TEXT NOT NULL,
  owners_json            TEXT NOT NULL
);
CREATE TABLE placed_container_presentation_rows (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  render_context     TEXT NOT NULL,
  cell               TEXT NOT NULL,
  map_id             TEXT,
  map_x              REAL,
  map_y              REAL,
  elevation          REAL,
  interaction_text   TEXT NOT NULL,
  lock_mode          TEXT NOT NULL,
  lock_level         TEXT NOT NULL,
  allow_lockpick     INTEGER NOT NULL,
  loot_list_count    INTEGER NOT NULL,
  additional_count   INTEGER NOT NULL,
  possible_item_count INTEGER NOT NULL,
  level_automatic    INTEGER NOT NULL,
  level_value        INTEGER NOT NULL
);
`;
