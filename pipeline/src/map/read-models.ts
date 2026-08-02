import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../entities/item/read-models.ts";

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
 * Projections from each placed entity's canonical tables into the generalized
 * map read models. Keyed by entity id; every entity whose descriptor declares a
 * `map` layer must appear here (enforced by `mapReadModelSupport`).
 */
const MAP_PROJECTIONS: Record<string, { points: string; volumes?: string }> = {
  location: {
    points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'location:' || l.id, 'location', l.id, l.name, p.map_id, p.map_x, p.map_y, p.elevation,
             l.show_on_map_debug_only, l.allow_fast_travel
      FROM locations l
      JOIN placements p ON p.entity_id = 'location' AND p.instance_id = l.id
      WHERE l.enabled = 1 AND l.show_on_map = 1
      ORDER BY l.name;
    `,
    volumes: `
      INSERT INTO map_volumes (
        id, entity_id, instance_id, name, map_id, geometry_json, elevation_min, elevation_max
      )
      SELECT v.id, 'location', v.location_id, l.name, p.map_id, v.geometry_json,
             v.elevation_min, v.elevation_max
      FROM location_volumes v
      JOIN locations l ON l.id = v.location_id
      JOIN placements p ON p.entity_id = 'location' AND p.instance_id = l.id
      WHERE l.enabled = 1
        AND v.geometry_json IS NOT NULL
      ORDER BY l.name, v.volume_index;
    `,
  },
  portal: {
    points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'portal:' || p.id, 'portal', p.id, p.name, pl.map_id, pl.map_x, pl.map_y, pl.elevation,
             0, 0
      FROM portals p
      JOIN placements pl ON pl.entity_id = 'portal' AND pl.instance_id = p.id
      ORDER BY p.name;
    `,
  },
};

/**
 * Emits `map_points`, `map_volumes`, and the map entity nodes for exactly the
 * placed entities named in `entityIds`. Callers derive that list from
 * descriptors plus present snapshot envelopes, so a missing projection is a
 * contract error rather than a silently empty map.
 */
export function emitMapReadModels(
  db: Database,
  entityIds: readonly string[],
  mapRoute = "/map",
): void {
  db.exec(MAP_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  for (const entityId of entityIds) {
    const projection = MAP_PROJECTIONS[entityId];
    if (!projection) {
      throw new Error(`emit-map-read-models: no map projection for entity '${entityId}'`);
    }
    db.exec(projection.points);
    if (projection.volumes) db.exec(projection.volumes);
  }

  const writeNode = prepareEntityNodeWriter(db);
  const nodeRows = db
    .query<
      { entity_id: string; instance_id: string; name: string; map_id: string | null },
      []
    >(`SELECT DISTINCT entity_id, instance_id, name, map_id FROM map_points ORDER BY entity_id, name`)
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
