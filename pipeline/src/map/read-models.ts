import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../entities/item/read-models.ts";
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
 * Emits `map_points`, `map_volumes`, and the map entity nodes for exactly the
 * placed entities named in `entityIds`. Callers derive that list from
 * The projection is supplied by the descriptor-driven entity registry. Callers
 * derive that list from descriptors plus present snapshot envelopes, so a missing
 * projection is a contract error rather than a silently empty map.
 */
export function emitMapReadModels(
  db: Database,
  entityIds: readonly string[],
  mapRoute = "/map",
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

  const writeNode = prepareEntityNodeWriter(db);
  const nodeRows = db
    .query<{ entity_id: string; instance_id: string; name: string; map_id: string | null }, []>(
      `SELECT DISTINCT entity_id, instance_id, name, map_id FROM map_points ORDER BY entity_id, name`,
    )
    .all();
  const tx = db.transaction(() => {
    for (const row of nodeRows) {
      const slug = deriveMapEntityNodeSlug(row.name, row.instance_id);
      const query = row.map_id
        ? `map=${encodeURIComponent(row.map_id)}&sel=${slug.shortId}`
        : `sel=${slug.shortId}`;
      writeNode({
        entityType: row.entity_id,
        entityId: row.instance_id,
        label: row.name,
        routePath: `${mapRoute}?${query}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}

function deriveMapEntityNodeSlug(
  displayName: string,
  entityId: string,
): { canonicalSlug: string; shortId: string } {
  return deriveEntityNodeSlug(displayName, entityId);
}
