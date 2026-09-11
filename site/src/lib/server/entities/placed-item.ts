import { all, get } from "../db";
import { validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface PlacedItemOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  cell: string;
  stack_count: number;
  item_id: string | null;
  item_name: string | null;
}

interface PlacedItemPresentationRecord extends PlacedItemOverviewRecord {
  render_context: string;
  map_id: string | null;
  map_x: number | null;
  map_y: number | null;
  elevation: number | null;
  durability: number;
  durability_ruined: number;
  enchantment_count: number;
}

export interface PlacedItemOverviewRow {
  id: string;
  name: string;
  routePath: string;
  cell: string;
  stackCount: number;
  item: { id: string; name: string } | null;
}

export interface PlacedItemPresentationRow extends PlacedItemOverviewRow {
  renderContext: "placed-item-presentation-v1";
  mapId: string | null;
  mapX: number | null;
  mapY: number | null;
  elevation: number | null;
  mapHref: string | null;
  durability: number;
  durabilityRuined: boolean;
  enchantmentCount: number;
  itemRoutePath: string | null;
}

const OVERVIEW_COLUMNS = `p.id, n.display_label AS name, n.route_path, p.cell, p.stack_count,
   p.item_id, p.item_name`;

const toOverviewRow = (row: PlacedItemOverviewRecord): PlacedItemOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  cell: row.cell,
  stackCount: row.stack_count,
  item: row.item_id === null ? null : { id: row.item_id, name: row.item_name ?? row.item_id },
});

export const listPlacedItems = (): PlacedItemOverviewRow[] =>
  all<PlacedItemOverviewRecord>(
    `SELECT ${OVERVIEW_COLUMNS}
     FROM placed_item_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'placed-item'
      AND n.entity_id = p.id
     ORDER BY p.item_name, p.cell, p.id`,
  ).map(toOverviewRow);

export const getPlacedItemPresentation = (slug: string): PlacedItemPresentationRow | undefined => {
  const node = getEntityNodeBySlug("placed-item", slug);
  if (!node) return undefined;
  const row = get<PlacedItemPresentationRecord>(
    `SELECT ${OVERVIEW_COLUMNS}, p.render_context, p.map_id, p.map_x, p.map_y, p.elevation,
            p.durability, p.durability_ruined, p.enchantment_count
     FROM placed_item_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'placed-item'
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
      "placed-item",
      row.id,
      "placed-item-presentation-v1",
    ),
    mapId: row.map_id,
    mapX: row.map_x,
    mapY: row.map_y,
    elevation: row.elevation,
    mapHref: getMapHref("placed-item", row.id),
    durability: row.durability,
    durabilityRuined: row.durability_ruined === 1,
    enchantmentCount: row.enchantment_count,
    itemRoutePath: itemRoute,
  };
};
