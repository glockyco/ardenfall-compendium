import { all, get } from "../db";
import { validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface WorldSpawnOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  cell: string;
  kind: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
}

interface WorldSpawnPresentationRecord extends WorldSpawnOverviewRecord {
  render_context: string;
  map_id: string | null;
  map_x: number | null;
  map_y: number | null;
  elevation: number | null;
}

export interface WorldSpawnOverviewRow {
  id: string;
  name: string;
  routePath: string;
  cell: string;
  kind: string;
  target: { type: string; id: string; name: string } | null;
}

export interface WorldSpawnPresentationRow extends WorldSpawnOverviewRow {
  renderContext: "world-spawn-presentation-v1";
  mapId: string | null;
  mapX: number | null;
  mapY: number | null;
  elevation: number | null;
  mapHref: string | null;
  targetRoutePath: string | null;
}

const OVERVIEW_COLUMNS = `s.id, n.display_label AS name, n.route_path, s.cell, s.kind,
   s.target_type, s.target_id, s.target_name`;

const toOverviewRow = (row: WorldSpawnOverviewRecord): WorldSpawnOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  cell: row.cell,
  kind: row.kind,
  target:
    row.target_type === null || row.target_id === null
      ? null
      : { id: row.target_id, name: row.target_name ?? row.target_id, type: row.target_type },
});

export const listWorldSpawns = (): WorldSpawnOverviewRow[] =>
  all<WorldSpawnOverviewRecord>(
    `SELECT ${OVERVIEW_COLUMNS}
     FROM world_spawn_presentation_rows s
     JOIN entity_nodes n
       ON n.entity_type = 'world-spawn'
      AND n.entity_id = s.id
     ORDER BY s.target_name, s.cell, s.id`,
  ).map(toOverviewRow);

export const getWorldSpawnPresentation = (slug: string): WorldSpawnPresentationRow | undefined => {
  const node = getEntityNodeBySlug("world-spawn", slug);
  if (!node) return undefined;
  const row = get<WorldSpawnPresentationRecord>(
    `SELECT ${OVERVIEW_COLUMNS}, s.render_context, s.map_id, s.map_x, s.map_y, s.elevation
     FROM world_spawn_presentation_rows s
     JOIN entity_nodes n
       ON n.entity_type = 'world-spawn'
      AND n.entity_id = s.id
     WHERE s.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  const targetRoute =
    row.target_type === null || row.target_id === null
      ? null
      : (get<{ route_path: string }>(
          `SELECT route_path FROM entity_nodes
           WHERE entity_type = ? AND entity_id = ? AND has_page = 1`,
          [row.target_type, row.target_id],
        )?.route_path ?? null);

  return {
    ...toOverviewRow(row),
    renderContext: validateRenderContext(
      row.render_context,
      "world-spawn",
      row.id,
      "world-spawn-presentation-v1",
    ),
    mapId: row.map_id,
    mapX: row.map_x,
    mapY: row.map_y,
    elevation: row.elevation,
    mapHref: getMapHref("world-spawn", row.id),
    targetRoutePath: targetRoute,
  };
};
