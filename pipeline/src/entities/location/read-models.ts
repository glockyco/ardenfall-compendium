import type { Database } from "bun:sqlite";

export const LOCATION_READ_MODEL_DDL = `
CREATE TABLE location_map_points (
  id                         TEXT PRIMARY KEY,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  map_x                      REAL NOT NULL,
  map_y                      REAL NOT NULL,
  elevation                  REAL NOT NULL,
  show_on_map                INTEGER NOT NULL,
  show_on_map_debug_only     INTEGER NOT NULL,
  allow_fast_travel          INTEGER NOT NULL
);
CREATE TABLE location_map_volumes (
  id                         TEXT PRIMARY KEY,
  location_id                TEXT NOT NULL,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  geometry_json              TEXT NOT NULL,
  elevation_min              REAL,
  elevation_max              REAL
);
`;

export function emitLocationReadModels(db: Database): void {
  db.exec(LOCATION_READ_MODEL_DDL);
  db.exec(`
    INSERT INTO location_map_points (
      id, name, map_id, map_x, map_y, elevation,
      show_on_map, show_on_map_debug_only, allow_fast_travel
    )
    SELECT id, name, map_id, map_x, map_y, elevation,
           show_on_map, show_on_map_debug_only, allow_fast_travel
    FROM locations
    WHERE enabled = 1 AND show_on_map = 1 AND show_on_map_debug_only = 0
    ORDER BY name;
  `);
  db.exec(`
    INSERT INTO location_map_volumes (
      id, location_id, name, map_id, geometry_json, elevation_min, elevation_max
    )
    SELECT v.id, v.location_id, l.name, l.map_id, v.geometry_json, v.elevation_min, v.elevation_max
    FROM location_volumes v
    JOIN locations l ON l.id = v.location_id
    WHERE l.enabled = 1
      AND v.geometry_json IS NOT NULL
    ORDER BY l.name, v.volume_index;
  `);
}
