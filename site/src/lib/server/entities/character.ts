import { getCharacterDialogue, type DialogueGroup } from "./dialogue";
import { all, get } from "../db";
import { isStringArray, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";
import { getMapHref } from "../map-href";

interface CharacterOverviewRecord {
  id: string;
  name: string;
  name_is_description: number;
  location_ids_json: string;
  route_path: string;
}

interface CharacterPresentationRecord {
  id: string;
  name: string;
  name_is_description: number;
  display_name_provenance: "own" | "inherited" | "absent";
  display_name_owner: string | null;
  render_context: string;
  map_id: string | null;
  map_x: number;
  map_y: number;
  elevation: number;
  location_ids_json: string;
  character_type_id: string | null;
  character_type_label: string | null;
  character_type_route_path: string | null;
  route_path: string;
}

interface LocationLinkRecord {
  id: string;
  label: string;
  route_path: string;
}

export interface CharacterOverviewRow {
  id: string;
  name: string;
  nameIsDescription: boolean;
  routePath: string;
  locations: CharacterLocationLink[];
}

export interface CharacterLocationLink {
  id: string;
  label: string;
  routePath: string;
}

export interface CharacterTypeLink {
  id: string;
  label: string;
  routePath: string | null;
}

export interface CharacterPresentationRow {
  id: string;
  name: string;
  nameIsDescription: boolean;
  displayNameProvenance: "own" | "inherited" | "absent";
  displayNameOwner: string | null;
  renderContext: "character-presentation-v1";
  routePath: string;
  characterType: CharacterTypeLink | null;
  mapId: string | null;
  mapLabel: string;
  mapX: number;
  mapY: number;
  elevation: number;
  mapHref: string | null;
  locations: CharacterLocationLink[];
  dialogue: DialogueGroup[];
}

const displayMapLabel = (mapId: string | null): string => {
  if (mapId === null) return "Unknown";
  return mapId.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

const resolvePublishedLocations = (
  locationIdsJson: string,
  characterId: string,
): CharacterLocationLink[] => {
  const locationIds = parseGeneratedJson(
    locationIdsJson,
    "npc",
    "location_ids_json",
    characterId,
    isStringArray,
  );
  return locationIds.map((locationId) => {
    const location = get<LocationLinkRecord>(
      `SELECT entity_id AS id, display_label AS label, route_path
       FROM entity_nodes
       WHERE entity_type = 'location' AND entity_id = ? AND has_page = 1`,
      [locationId],
    );
    if (!location) {
      throw new Error(
        `Character '${characterId}' references missing location page '${locationId}'`,
      );
    }
    return { id: location.id, label: location.label, routePath: location.route_path };
  });
};

export const listCharacters = (): CharacterOverviewRow[] => {
  const rows = all<CharacterOverviewRecord>(
    `SELECT o.id, n.display_label AS name, o.name_is_description, o.location_ids_json, n.route_path
     FROM npc_presentation_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'npc'
      AND n.entity_id = o.id
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    nameIsDescription: row.name_is_description === 1,
    routePath: row.route_path,
    locations: resolvePublishedLocations(row.location_ids_json, row.id),
  }));
  return rows;
};

export const getCharacterPresentation = (slug: string): CharacterPresentationRow | undefined => {
  const node = getEntityNodeBySlug("npc", slug);
  if (!node) return undefined;
  const row = get<CharacterPresentationRecord>(
    `SELECT p.id, n.display_label AS name, p.name_is_description,
            p.display_name_provenance, p.display_name_owner,
            p.render_context, p.map_id, p.map_x, p.map_y, p.elevation,
            p.location_ids_json, p.character_type_id, p.character_type_label,
            p.character_type_route_path, n.route_path
     FROM npc_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'npc'
      AND n.entity_id = p.id
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  const locations = resolvePublishedLocations(row.location_ids_json, row.id);
  let characterType: CharacterTypeLink | null = null;
  if (row.character_type_id !== null) {
    if (row.character_type_label === null) {
      throw new Error(`Character '${row.id}' has a character type without a label`);
    }
    characterType = {
      id: row.character_type_id,
      label: row.character_type_label,
      routePath: row.character_type_route_path,
    };
  }

  return {
    id: row.id,
    name: row.name,
    nameIsDescription: row.name_is_description === 1,
    displayNameProvenance: row.display_name_provenance,
    displayNameOwner: row.display_name_owner,
    renderContext: validateRenderContext(
      row.render_context,
      "npc",
      row.id,
      "character-presentation-v1",
    ),
    routePath: row.route_path,
    characterType,
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
