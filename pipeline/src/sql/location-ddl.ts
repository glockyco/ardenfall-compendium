export const LOCATION_DDL = `
CREATE TABLE placements (
  entity_id                  TEXT NOT NULL,
  instance_id                TEXT NOT NULL,
  map_id                     TEXT,
  map_x                      REAL NOT NULL,
  map_y                      REAL NOT NULL,
  elevation                  REAL NOT NULL,
  source_ref_json            TEXT NOT NULL,
  PRIMARY KEY (entity_id, instance_id)
);
CREATE TABLE locations (
  id                         TEXT PRIMARY KEY NOT NULL,
  name                       TEXT,
  enabled                    INTEGER NOT NULL,
  map_id                     TEXT,
  map_ref_json               TEXT,
  show_on_map                INTEGER NOT NULL,
  show_on_map_debug_only     INTEGER NOT NULL,
  icon_ref_json              TEXT,
  source_map_position_json   TEXT NOT NULL,
  allow_fast_travel          INTEGER NOT NULL,
  source_fast_travel_json    TEXT
);
CREATE TABLE location_volumes (
  id                    TEXT PRIMARY KEY,
  location_id           TEXT NOT NULL REFERENCES locations(id),
  volume_index          INTEGER NOT NULL,
  kind                  TEXT NOT NULL,
  source_center_json    TEXT NOT NULL,
  source_size_json      TEXT NOT NULL,
  map_min_x             REAL,
  map_min_y             REAL,
  map_max_x             REAL,
  map_max_y             REAL,
  elevation_min         REAL,
  elevation_max         REAL,
  geometry_json         TEXT,
  UNIQUE(location_id, volume_index)
);
`;
