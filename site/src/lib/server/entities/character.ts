import { all, get } from "../db";
import { parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface CharacterOverviewRecord {
  id: string;
  name: string | null;
  route_path: string;
  display_label: string;
}

interface CharacterPresentationRecord {
  id: string;
  name: string | null;
  render_context: string;
  drop_refs_json: string;
  route_path: string;
  display_label: string;
}

export interface CharacterDrop {
  label: string;
  routePath: string | null;
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

export interface CharacterOverviewRow {
  id: string;
  name: string | null;
  displayName: string;
  routePath: string;
}

export interface CharacterPresentationRow {
  id: string;
  name: string | null;
  renderContext: "character-presentation-v1";
  displayName: string;
  drops: CharacterDrop[];
  routePath: string;
}

export const listCharacters = (): CharacterOverviewRow[] => {
  const rows = all<CharacterOverviewRecord>(
    `SELECT o.id, o.name, n.route_path, n.display_label
     FROM character_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'character'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    displayName: row.display_label,
    routePath: row.route_path,
  }));
  return rows;
};

export const getCharacterPresentation = (slug: string): CharacterPresentationRow | undefined => {
  const node = getEntityNodeBySlug("character", slug);
  if (!node) return undefined;
  const row = get<CharacterPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.drop_refs_json, n.route_path,
            n.display_label
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
    renderContext: validateRenderContext(
      row.render_context,
      "character",
      row.id,
      "character-presentation-v1",
    ),
    displayName: row.display_label,
    drops: parseGeneratedJson(
      row.drop_refs_json,
      "character",
      "drop_refs_json",
      row.id,
      isCharacterDropArray,
    ),
    routePath: row.route_path,
  };
};
