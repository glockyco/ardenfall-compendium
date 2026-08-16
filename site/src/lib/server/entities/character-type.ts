import { all, get } from "../db";
import { parseGeneratedJson, validateRenderContext } from "../json";
import { getMapHref } from "../map-href";
import { getEntityNodeBySlug } from "./item";

interface CharacterTypeOverviewRecord {
  id: string;
  name: string | null;
  name_is_description: number;
  route_path: string;
  display_label: string;
}

interface CharacterTypePresentationRecord {
  id: string;
  name: string | null;
  name_is_description: number;
  render_context: string;
  drop_refs_json: string;
  route_path: string;
  display_label: string;
}

export interface CharacterDrop {
  label: string;
  routePath: string | null;
}

export interface CharacterPlacementLink {
  id: string;
  label: string;
  routePath: string | null;
  mapHref: string | null;
}

const isCharacterDropArray = (value: unknown): value is CharacterDrop[] =>
  Array.isArray(value) &&
  value.every(
    (drop) =>
      typeof drop === "object" &&
      drop !== null &&
      !Array.isArray(drop) &&
      typeof (drop as { label?: unknown }).label === "string" &&
      ((drop as { routePath?: unknown }).routePath === null ||
        typeof (drop as { routePath?: unknown }).routePath === "string"),
  );

export interface CharacterTypeOverviewRow {
  id: string;
  name: string | null;
  nameIsDescription: boolean;
  displayName: string;
  routePath: string;
}

export interface CharacterTypePresentationRow {
  id: string;
  name: string | null;
  nameIsDescription: boolean;
  renderContext: "character-type-presentation-v1";
  displayName: string;
  drops: CharacterDrop[];
  placements: CharacterPlacementLink[];
  routePath: string;
}

interface CharacterPlacementRecord {
  id: string;
  label: string;
  route_path: string | null;
}

const getCharacterTypePlacements = (characterTypeId: string): CharacterPlacementLink[] =>
  all<CharacterPlacementRecord>(
    `SELECT e.source_id AS id, n.display_label AS label, n.route_path
     FROM entity_edges e
     JOIN entity_nodes n
       ON n.entity_type = e.source_type
      AND n.entity_id = e.source_id
      AND n.has_page = 1
     WHERE e.source_type = 'npc'
       AND e.target_type = 'character'
       AND e.target_id = ?
       AND e.predicate = 'instance_of'
     ORDER BY n.display_label, e.source_id`,
    [characterTypeId],
  ).map((row) => ({
    id: row.id,
    label: row.label,
    routePath: row.route_path,
    mapHref: getMapHref("npc", row.id),
  }));

export const listCharacterTypes = (): CharacterTypeOverviewRow[] => {
  const rows = all<CharacterTypeOverviewRecord>(
    `SELECT o.id, o.name, o.name_is_description, n.route_path, n.display_label
     FROM character_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'character'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    nameIsDescription: row.name_is_description === 1,
    displayName: row.display_label,
    routePath: row.route_path,
  }));
  return rows;
};

export const getCharacterTypePresentation = (
  slug: string,
): CharacterTypePresentationRow | undefined => {
  const node = getEntityNodeBySlug("character", slug);
  if (!node) return undefined;
  const row = get<CharacterTypePresentationRecord>(
    `SELECT p.id, p.name, p.name_is_description, p.render_context, p.drop_refs_json,
            n.route_path, n.display_label
     FROM character_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'character'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    nameIsDescription: row.name_is_description === 1,
    renderContext: validateRenderContext(
      row.render_context,
      "character",
      row.id,
      "character-type-presentation-v1",
    ),
    displayName: row.display_label,
    drops: parseGeneratedJson(
      row.drop_refs_json,
      "character",
      "drop_refs_json",
      row.id,
      isCharacterDropArray,
    ),
    placements: getCharacterTypePlacements(row.id),
    routePath: row.route_path,
  };
};
