import { all, get } from "../db";
import { isRichTextDocument, parseGeneratedJson, validateRenderContext } from "../json";
import type { RichTextDocument } from "./item";
import { getEntityNodeBySlug } from "./item";

interface SpellOverviewRecord {
  id: string;
  name: string;
  skill: string | null;
  mana_cost: number | null;
  is_illegal: number;
  route_path: string;
}

interface SpellPresentationRecord {
  id: string;
  name: string;
  render_context: string;
  skill: string | null;
  mana_cost: number | null;
  is_illegal: number;
  tooltip_rich_text_json: string | null;
  /** Joined from the governing skill's public node, null when the spell has none. */
  skill_route_path: string | null;
  route_path: string;
}

export interface SpellOverviewRow {
  id: string;
  name: string;
  skill: string | null;
  manaCost: number | null;
  isIllegal: boolean;
  routePath: string;
}

export interface SpellPresentationRow {
  id: string;
  name: string;
  renderContext: "spell-presentation-v1";
  skill: string | null;
  skillRoutePath: string | null;
  manaCost: number | null;
  isIllegal: boolean;
  description: RichTextDocument | null;
  descriptionText: string | null;
  routePath: string;
}

export const listSpells = (): SpellOverviewRow[] =>
  all<SpellOverviewRecord>(
    `SELECT o.id, o.name, o.skill, o.mana_cost, o.is_illegal, n.route_path
     FROM spell_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'spell'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    skill: row.skill,
    manaCost: row.mana_cost,
    isIllegal: row.is_illegal === 1,
    routePath: row.route_path,
  }));

export const getSpellPresentation = (slug: string): SpellPresentationRow | undefined => {
  const node = getEntityNodeBySlug("spell", slug);
  if (!node) return undefined;
  const row = get<SpellPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.skill, p.mana_cost, p.is_illegal,
            p.tooltip_rich_text_json,
            sn.route_path AS skill_route_path,
            n.route_path
     FROM spell_presentation_rows p
     LEFT JOIN entity_nodes sn
       ON sn.entity_type = 'stat-type'
      AND sn.entity_id = p.skill_id
      AND sn.is_public = 1
     JOIN entity_nodes n
       ON n.entity_type = 'spell'
      AND n.entity_id = p.id
      AND n.is_public = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  const description = row.tooltip_rich_text_json
    ? parseGeneratedJson(
        row.tooltip_rich_text_json,
        "spell",
        "tooltip_rich_text_json",
        row.id,
        isRichTextDocument,
      )
    : null;
  return {
    id: row.id,
    name: row.name,
    renderContext: validateRenderContext(
      row.render_context,
      "spell",
      row.id,
      "spell-presentation-v1",
    ),
    skill: row.skill,
    skillRoutePath: row.skill_route_path,
    manaCost: row.mana_cost,
    isIllegal: row.is_illegal === 1,
    description,
    descriptionText: description ? richTextPlainText(description) : null,
    routePath: row.route_path,
  };
};

function richTextPlainText(document: RichTextDocument): string {
  const visit = (node: RichTextDocument["nodes"][number]): string => {
    if (node.type === "text") return node.text;
    if (node.type === "lineBreak") return " ";
    if (node.type === "sprite") return node.name;
    if (node.type === "termLink") return node.label;
    return node.children.map(visit).join("");
  };
  return document.nodes.map(visit).join("").replace(/\s+/g, " ").trim();
}
