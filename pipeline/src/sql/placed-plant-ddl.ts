export const PLACED_PLANT_DDL = `
CREATE TABLE placed_plants (
  id                    TEXT PRIMARY KEY NOT NULL,
  cell                  TEXT NOT NULL,
  map_id                TEXT,
  source_position_json  TEXT NOT NULL,
  item_ref_json         TEXT NOT NULL,
  item_count            INTEGER NOT NULL,
  regrow_days           INTEGER NOT NULL,
  harvest_xp            INTEGER NOT NULL,
  interaction_text      TEXT NOT NULL
);
CREATE TABLE placed_plant_presentation_rows (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  render_context    TEXT NOT NULL,
  cell              TEXT NOT NULL,
  map_id            TEXT,
  map_x             REAL,
  map_y             REAL,
  elevation         REAL,
  item_id           TEXT,
  item_name         TEXT,
  item_count        INTEGER NOT NULL,
  regrow_days       INTEGER NOT NULL,
  harvest_xp        INTEGER NOT NULL,
  interaction_text  TEXT NOT NULL
);
`;
