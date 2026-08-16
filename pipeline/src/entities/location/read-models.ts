import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes";

export interface LocationMapProjection {
  points: string;
  volumes: string;
}

export function emitLocationReadModels(db: Database): void {
  db.exec(ENTITY_GRAPH_DDL);
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<{ id: string; name: string }, []>(
      `SELECT id, COALESCE(NULLIF(TRIM(name), ''), 'Unnamed location') AS name
       FROM locations ORDER BY name, id`,
    )
    .all();
  const tx = db.transaction(() => {
    for (const row of rows) {
      const slug = deriveEntityNodeSlug(row.name, row.id);
      writeNode({
        entityType: "location",
        entityId: row.id,
        label: row.name,
        routePath: `/locations/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
      });
    }
  });
  tx();
}

export const locationProjection: LocationMapProjection = {
  points: `
      INSERT INTO map_points (
        id, entity_id, instance_id, name, map_id, map_x, map_y, elevation,
        enabled, show_on_map_debug_only, allow_fast_travel
      )
      SELECT 'location:' || l.id, 'location', l.id,
             COALESCE(NULLIF(TRIM(l.name), ''), 'Unnamed location'),
             p.map_id, p.map_x, p.map_y, p.elevation,
             l.enabled, l.show_on_map_debug_only, l.allow_fast_travel
      FROM locations l
      JOIN placements p ON p.entity_id = 'location' AND p.instance_id = l.id
      ORDER BY COALESCE(NULLIF(TRIM(l.name), ''), 'Unnamed location'), l.id;
    `,
  volumes: `
      INSERT INTO map_volumes (
        id, entity_id, instance_id, name, map_id, geometry_json, elevation_min, elevation_max
      )
      SELECT v.id, 'location', v.location_id,
             COALESCE(NULLIF(TRIM(l.name), ''), 'Unnamed location'),
             p.map_id, v.geometry_json,
             v.elevation_min, v.elevation_max
      FROM location_volumes v
      JOIN locations l ON l.id = v.location_id
      JOIN placements p ON p.entity_id = 'location' AND p.instance_id = v.location_id
      WHERE v.geometry_json IS NOT NULL
      ORDER BY COALESCE(NULLIF(TRIM(l.name), ''), 'Unnamed location'), v.volume_index;
    `,
};
