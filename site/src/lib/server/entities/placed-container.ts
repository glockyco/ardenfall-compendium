import { all, get } from "../db";
import { validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface ContainerOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  cell: string;
  lock_mode: string;
}

interface ContainerPresentationRecord extends ContainerOverviewRecord {
  render_context: string;
  map_id: string | null;
  map_x: number | null;
  map_y: number | null;
  elevation: number | null;
  interaction_text: string;
  lock_level: string;
  allow_lockpick: number;
  loot_list_count: number;
  additional_count: number;
  possible_item_count: number;
  level_automatic: number;
  level_value: number;
}

export interface ContainerOverviewRow {
  id: string;
  name: string;
  routePath: string;
  cell: string;
  lockMode: string;
}

export interface ContainerPresentationRow extends ContainerOverviewRow {
  renderContext: "placed-container-presentation-v1";
  mapId: string | null;
  mapX: number | null;
  mapY: number | null;
  elevation: number | null;
  mapHref: string | null;
  interactionText: string;
  lockLevel: string;
  allowLockpick: boolean;
  lootListCount: number;
  additionalCount: number;
  possibleItemCount: number;
  levelAutomatic: boolean;
  levelValue: number;
}

const OVERVIEW_COLUMNS = `c.id, n.display_label AS name, n.route_path, c.cell, c.lock_mode`;

const toOverviewRow = (row: ContainerOverviewRecord): ContainerOverviewRow => ({
  id: row.id,
  name: row.name,
  routePath: row.route_path,
  cell: row.cell,
  lockMode: row.lock_mode,
});

export const listContainers = (): ContainerOverviewRow[] =>
  all<ContainerOverviewRecord>(
    `SELECT ${OVERVIEW_COLUMNS}
     FROM placed_container_presentation_rows c
     JOIN entity_nodes n
       ON n.entity_type = 'placed-container'
      AND n.entity_id = c.id
     ORDER BY c.name, c.id`,
  ).map(toOverviewRow);

export const getContainerPresentation = (slug: string): ContainerPresentationRow | undefined => {
  const node = getEntityNodeBySlug("placed-container", slug);
  if (!node) return undefined;
  const row = get<ContainerPresentationRecord>(
    `SELECT ${OVERVIEW_COLUMNS}, c.render_context, c.map_id, c.map_x, c.map_y, c.elevation,
            c.interaction_text, c.lock_level, c.allow_lockpick, c.loot_list_count,
            c.additional_count, c.possible_item_count, c.level_automatic, c.level_value
     FROM placed_container_presentation_rows c
     JOIN entity_nodes n
       ON n.entity_type = 'placed-container'
      AND n.entity_id = c.id
     WHERE c.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  return {
    ...toOverviewRow(row),
    renderContext: validateRenderContext(
      row.render_context,
      "placed-container",
      row.id,
      "placed-container-presentation-v1",
    ),
    mapId: row.map_id,
    mapX: row.map_x,
    mapY: row.map_y,
    elevation: row.elevation,
    mapHref: getMapHref("placed-container", row.id),
    interactionText: row.interaction_text,
    lockLevel: row.lock_level,
    allowLockpick: row.allow_lockpick === 1,
    lootListCount: row.loot_list_count,
    additionalCount: row.additional_count,
    possibleItemCount: row.possible_item_count,
    levelAutomatic: row.level_automatic === 1,
    levelValue: row.level_value,
  };
};
