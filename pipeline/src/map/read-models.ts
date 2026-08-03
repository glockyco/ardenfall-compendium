import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../relationships/relationship-graph.ts";
import { entityRegistry } from "../entities/registry";

export const MAP_READ_MODEL_DDL = `
CREATE TABLE map_points (
  id                         TEXT PRIMARY KEY,
  entity_id                  TEXT NOT NULL,
  instance_id                TEXT NOT NULL,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  map_x                      REAL NOT NULL,
  map_y                      REAL NOT NULL,
  elevation                  REAL NOT NULL,
  show_on_map_debug_only     INTEGER NOT NULL,
  allow_fast_travel          INTEGER NOT NULL
);
CREATE INDEX idx_map_points_entity_id_map_id ON map_points (entity_id, map_id);
CREATE TABLE map_volumes (
  id                         TEXT PRIMARY KEY,
  entity_id                  TEXT NOT NULL,
  instance_id                TEXT NOT NULL,
  name                       TEXT NOT NULL,
  map_id                     TEXT,
  geometry_json              TEXT NOT NULL,
  elevation_min              REAL,
  elevation_max              REAL
);
CREATE INDEX idx_map_volumes_entity_id_map_id ON map_volumes (entity_id, map_id);
`;

/**
 * Emits `map_points` and `map_volumes` for exactly the placed entities named in
 * `entityIds`. Entity nodes come from each entity's canonical read model.
 * The projection is supplied by the descriptor-driven entity registry. Callers
 * derive that list from descriptors plus present snapshot envelopes, so a
 * missing projection is a contract error rather than a silently empty map.
 */
export function emitMapReadModels(
  db: Database,
  entityIds: readonly string[],
  _mapRoute = "/map",
): void {
  db.exec(MAP_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  for (const entityId of entityIds) {
    const projection = entityRegistry[entityId]?.mapProjection;
    if (!projection) {
      throw new Error(`emit-map-read-models: no map projection for entity '${entityId}'`);
    }
    db.exec(projection.points);
    if (projection.volumes) db.exec(projection.volumes);
  }
}
