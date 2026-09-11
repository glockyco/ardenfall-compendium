export const PLACED_ITEM_DDL = `
CREATE TABLE placed_items (
  id                    TEXT PRIMARY KEY NOT NULL,
  cell                  TEXT NOT NULL,
  map_id                TEXT,
  source_position_json  TEXT NOT NULL,
  item_ref_json         TEXT NOT NULL,
  stack_count           INTEGER NOT NULL,
  durability            REAL NOT NULL,
  durability_ruined     INTEGER NOT NULL,
  enchantments_json     TEXT NOT NULL,
  owners_json           TEXT NOT NULL
);
CREATE TABLE placed_item_presentation_rows (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  render_context     TEXT NOT NULL,
  cell               TEXT NOT NULL,
  map_id             TEXT,
  map_x              REAL,
  map_y              REAL,
  elevation          REAL,
  item_id            TEXT,
  item_name          TEXT,
  stack_count        INTEGER NOT NULL,
  durability         REAL NOT NULL,
  durability_ruined  INTEGER NOT NULL,
  enchantment_count  INTEGER NOT NULL
);
`;
