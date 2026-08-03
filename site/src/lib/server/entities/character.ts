import { all, get } from "../db";
import { getEntityNodeBySlug } from "./item";

interface CharacterOverviewRecord {
  id: string;
  name: string | null;
  route_path: string;
}

interface CharacterPresentationRecord {
  id: string;
  name: string | null;
  render_context: "character-presentation-v1";
  route_path: string;
}

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
  routePath: string;
}

export const listCharacters = (): CharacterOverviewRow[] => {
  const rows = all<CharacterOverviewRecord>(
    `SELECT o.id, o.name, n.route_path
     FROM character_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'character'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    displayName: characterName(row.name, row.id),
    routePath: row.route_path,
  }));
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.displayName, (counts.get(row.displayName) ?? 0) + 1);
  return rows.map((row) =>
    (counts.get(row.displayName) ?? 0) > 1
      ? { ...row, displayName: `${row.displayName} (${row.id})` }
      : row,
  );
};

export const getCharacterPresentation = (slug: string): CharacterPresentationRow | undefined => {
  const node = getEntityNodeBySlug("character", slug);
  if (!node) return undefined;
  const row = get<CharacterPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, n.route_path
     FROM character_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'character'
      AND n.entity_id = p.id
      AND n.is_public = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    renderContext: row.render_context,
    displayName: characterName(row.name, row.id),
    routePath: row.route_path,
  };
};

function characterName(name: string | null, id: string): string {
  const normalizedName = name?.trim().toLowerCase();
  if (name && normalizedName !== "unnamed character") return name;
  return `Unnamed character · ${id}`;
}
