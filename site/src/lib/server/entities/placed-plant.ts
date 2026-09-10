import { all, get } from "../db";
import { validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface PlacedPlantOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  cell: string;
  harvest_xp: number;
  regrow_days: number;
  item_count: number;
  item_id: string | null;
  item_name: string | null;
}

interface PlacedPlantPresentationRecord extends PlacedPlantOverviewRecord {
  render_context: string;
  map_id: string | null;
  map_x: number | null;
  map_y: number | null;
  elevation: number | null;
  interaction_text: string;
}

export interface PlacedPlantOverviewRow {
  id: string;
  name: string;
  routePath: string;
  cell: string;
  harvestXp: number;
  regrowDays: number;
  itemCount: number;
  item: { id: string; name: string } | null;
}

export interface PlacedPlantPresentationRow extends PlacedPlantOverviewRow {
  renderContext: "placed-plant-presentation-v1";
  mapId: string | null;
  mapX: number | null;
  mapY: number | null;
  elevation: number | null;
  mapHref: string | null;
  interactionText: string;
  itemRoutePath: string | null;
}

const OVERVIEW_COLUMNS = `p.id, n.display_label AS name, n.route_path, p.cell, p.harvest_xp,
   p.regrow_days, p.item_count, p.item_id, p.item_name`;

const toOverviewRow = (row: PlacedPlantOverviewRecord): PlacedPlantOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  cell: row.cell,
  harvestXp: row.harvest_xp,
  regrowDays: row.regrow_days,
  itemCount: row.item_count,
  item: row.item_id === null ? null : { id: row.item_id, name: row.item_name ?? row.item_id },
});

export const listPlacedPlants = (): PlacedPlantOverviewRow[] =>
  all<PlacedPlantOverviewRecord>(
    `SELECT ${OVERVIEW_COLUMNS}
     FROM placed_plant_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'placed-plant'
      AND n.entity_id = p.id
     ORDER BY p.item_name, p.cell, p.id`,
  ).map(toOverviewRow);

export const getPlacedPlantPresentation = (
  slug: string,
): PlacedPlantPresentationRow | undefined => {
  const node = getEntityNodeBySlug("placed-plant", slug);
  if (!node) return undefined;
  const row = get<PlacedPlantPresentationRecord>(
    `SELECT ${OVERVIEW_COLUMNS}, p.render_context, p.map_id, p.map_x, p.map_y, p.elevation,
            p.interaction_text
     FROM placed_plant_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'placed-plant'
      AND n.entity_id = p.id
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  const itemRoute =
    row.item_id === null
      ? null
      : (get<{ route_path: string }>(
          `SELECT route_path FROM entity_nodes
           WHERE entity_type = 'item' AND entity_id = ? AND has_page = 1`,
          [row.item_id],
        )?.route_path ?? null);

  return {
    ...toOverviewRow(row),
    renderContext: validateRenderContext(
      row.render_context,
      "placed-plant",
      row.id,
      "placed-plant-presentation-v1",
    ),
    mapId: row.map_id,
    mapX: row.map_x,
    mapY: row.map_y,
    elevation: row.elevation,
    mapHref: getMapHref("placed-plant", row.id),
    interactionText: row.interaction_text,
    itemRoutePath: itemRoute,
  };
};
