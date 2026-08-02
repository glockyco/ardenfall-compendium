import { all, get } from "../db";
import { getEntityNodeBySlug } from "./item";

interface SpellOverviewRecord {
  id: string;
  name: string;
  school: string | null;
  mana_cost: number | null;
  is_illegal: number;
  route_path: string;
}

interface SpellPresentationRecord {
  id: string;
  name: string;
  render_context: "spell-presentation-v1";
  school: string | null;
  mana_cost: number | null;
  is_illegal: number;
  school_route_path: string | null;
}

export interface SpellOverviewRow {
  id: string;
  name: string;
  school: string | null;
  manaCost: number | null;
  isIllegal: boolean;
  routePath: string;
}

export interface SpellPresentationRow {
  id: string;
  name: string;
  renderContext: "spell-presentation-v1";
  school: string | null;
  schoolRoutePath: string | null;
  manaCost: number | null;
  isIllegal: boolean;
}

export const listSpells = (): SpellOverviewRow[] =>
  all<SpellOverviewRecord>(
    `SELECT o.id, o.name, o.school, o.mana_cost, o.is_illegal, n.route_path
     FROM spell_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'spell'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    school: row.school,
    manaCost: row.mana_cost,
    isIllegal: row.is_illegal === 1,
    routePath: row.route_path,
  }));

export const getSpellPresentation = (slug: string): SpellPresentationRow | undefined => {
  const node = getEntityNodeBySlug("spell", slug);
  if (!node) return undefined;
  const row = get<SpellPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.school, p.mana_cost, p.is_illegal,
            sn.route_path AS school_route_path
     FROM spell_presentation_rows p
     LEFT JOIN entity_nodes sn
       ON sn.entity_type = 'stat-type'
      AND sn.entity_id = p.school_id
      AND sn.is_public = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    renderContext: row.render_context,
    school: row.school,
    schoolRoutePath: row.school_route_path,
    manaCost: row.mana_cost,
    isIllegal: row.is_illegal === 1,
  };
};
