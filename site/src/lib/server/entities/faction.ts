import { disambiguateLabels } from "../disambiguate-labels";
import { all, get } from "../db";
import { validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface FactionOverviewRecord {
  id: string;
  name: string | null;
  description: string;
  route_path: string;
  short_id: string;
}

interface FactionPresentationRecord {
  id: string;
  name: string | null;
  render_context: string;
  description: string;
  alliable: number;
  enable_reputation: number;
  can_be_disguised: number;
  enable_bounty: number;
  route_path: string;
  short_id: string;
  name_count: number;
}

export interface FactionOverviewRow {
  id: string;
  name: string | null;
  displayName: string;
  description: string;
  routePath: string;
}

export interface FactionPresentationRow {
  id: string;
  name: string | null;
  renderContext: "faction-presentation-v1";
  displayName: string;
  description: string;
  alliable: boolean;
  enableReputation: boolean;
  canBeDisguised: boolean;
  enableBounty: boolean;
  routePath: string;
}

export const listFactions = (): FactionOverviewRow[] => {
  const rows = all<FactionOverviewRecord>(
    `SELECT o.id, o.name, o.description, n.route_path, n.short_id
     FROM faction_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'faction'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    displayName: factionName(row.name, row.short_id),
    description: row.description,
    routePath: row.route_path,
    shortId: row.short_id,
  }));
  return disambiguateLabels(rows, "displayName", (row) => row.shortId).map(
    ({ shortId: _shortId, ...row }) => row,
  );
};

export const getFactionPresentation = (slug: string): FactionPresentationRow | undefined => {
  const node = getEntityNodeBySlug("faction", slug);
  if (!node) return undefined;
  const row = get<FactionPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.description, p.alliable,
            p.enable_reputation, p.can_be_disguised, p.enable_bounty,
            n.route_path, n.short_id,
            (SELECT COUNT(*) FROM faction_presentation_rows same_name
              WHERE same_name.name = p.name) AS name_count
     FROM faction_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'faction'
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
      "faction",
      row.id,
      "faction-presentation-v1",
    ),
    displayName: factionName(row.name, row.short_id, row.name_count > 1),
    description: row.description,
    alliable: row.alliable === 1,
    enableReputation: row.enable_reputation === 1,
    canBeDisguised: row.can_be_disguised === 1,
    enableBounty: row.enable_bounty === 1,
    routePath: row.route_path,
  };
};

function factionName(name: string | null, shortId: string, repeated = false): string {
  const label = name?.trim() || "Unnamed faction";
  return !name?.trim() || repeated ? `${label} · ${shortId}` : label;
}
