import { get } from "./db";

export interface MapHrefInput {
  mapId: string | null;
  shortId: string | null;
}

interface MapPresenceRecord {
  map_id: string | null;
  short_id: string;
}

/** Build a map selection href from a map id and an entity node short id. */
export const buildMapHref = ({ mapId, shortId }: MapHrefInput): string | null => {
  if (mapId === null || shortId === null) return null;
  const params = new URLSearchParams({ map: mapId, sel: shortId });
  return `/map?${params.toString()}`;
};

/** Read an entity instance's map selection href from the emitted map tables. */
export const getMapHref = (entityType: string, instanceId: string): string | null => {
  const row = get<MapPresenceRecord>(
    `SELECT CASE
              WHEN EXISTS (
                SELECT 1 FROM map_points p
                WHERE p.entity_id = ? AND p.instance_id = ?
              ) THEN (
                SELECT p.map_id FROM map_points p
                WHERE p.entity_id = ? AND p.instance_id = ?
                ORDER BY p.id LIMIT 1
              )
              ELSE (
                SELECT v.map_id FROM map_volumes v
                WHERE v.entity_id = ? AND v.instance_id = ?
                ORDER BY v.id LIMIT 1
              )
            END AS map_id,
            n.short_id
     FROM entity_nodes n
     WHERE n.entity_type = ? AND n.entity_id = ? AND n.has_page = 1`,
    [
      entityType,
      instanceId,
      entityType,
      instanceId,
      entityType,
      instanceId,
      entityType,
      instanceId,
    ],
  );
  return row ? buildMapHref({ mapId: row.map_id, shortId: row.short_id }) : null;
};
