import { getCharacterDialogue, type DialogueGroup } from "./dialogue";
import { all, get } from "../db";
import { isStringArray, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";
import { getMapHref } from "../map-href";

interface NpcOverviewRecord {
  id: string;
  name: string;
  route_path: string;
}

interface NpcPresentationRecord {
  id: string;
  name: string;
  render_context: string;
  map_id: string | null;
  map_x: number;
  map_y: number;
  elevation: number;
  location_ids_json: string;
  route_path: string;
}

interface LocationLinkRecord {
  id: string;
  label: string;
  route_path: string;
}

export interface PlacedCharacterOverviewRow {
  id: string;
  name: string;
  routePath: string;
}

export interface PlacedCharacterLocationLink {
  id: string;
  label: string;
  routePath: string;
}

export interface PlacedCharacterPresentationRow {
  id: string;
  name: string;
  renderContext: "placed-character-presentation-v1";
  routePath: string;
  mapId: string | null;
  mapLabel: string;
  mapX: number;
  mapY: number;
  elevation: number;
  mapHref: string | null;
  locations: PlacedCharacterLocationLink[];
  dialogue: DialogueGroup[];
}

const displayMapLabel = (mapId: string | null): string => {
  if (mapId === null) return "Unknown";
  return mapId.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

export const listPlacedCharacters = (): PlacedCharacterOverviewRow[] => {
  const rows = all<NpcOverviewRecord>(
    `SELECT o.id, n.display_label AS name, n.route_path
     FROM npc_presentation_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'npc'
      AND n.entity_id = o.id
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    routePath: row.route_path,
  }));
  return rows;
};

export const getPlacedCharacterPresentation = (
  slug: string,
): PlacedCharacterPresentationRow | undefined => {
  const node = getEntityNodeBySlug("npc", slug);
  if (!node) return undefined;
  const row = get<NpcPresentationRecord>(
    `SELECT p.id, n.display_label AS name, p.render_context, p.map_id, p.map_x, p.map_y, p.elevation,
            p.location_ids_json, n.route_path
     FROM npc_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'npc'
      AND n.entity_id = p.id
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  const locationIds = parseGeneratedJson(
    row.location_ids_json,
    "npc",
    "location_ids_json",
    row.id,
    isStringArray,
  );
  const locations = locationIds.map((locationId) => {
    const location = get<LocationLinkRecord>(
      `SELECT entity_id AS id, display_label AS label, route_path
       FROM entity_nodes
       WHERE entity_type = 'location' AND entity_id = ? AND has_page = 1`,
      [locationId],
    );
    if (!location) {
      throw new Error(`NPC '${row.id}' references missing location page '${locationId}'`);
    }
    return { id: location.id, label: location.label, routePath: location.route_path };
  });

  return {
    id: row.id,
    name: row.name,
    renderContext: validateRenderContext(
      row.render_context,
      "npc",
      row.id,
      "placed-character-presentation-v1",
    ),
    routePath: row.route_path,
    mapId: row.map_id,
    mapLabel: displayMapLabel(row.map_id),
    mapX: row.map_x,
    mapY: row.map_y,
    elevation: row.elevation,
    mapHref: getMapHref("npc", row.id),
    locations,
    dialogue: getCharacterDialogue(row.id),
  };
};
