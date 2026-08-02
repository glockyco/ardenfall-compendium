import { all, get } from "../db";
import { getEntityNodeBySlug } from "./item";
import type { RelationshipEdge, RichTextDocument } from "./item";

interface StatusEffectOverviewRecord {
  id: string;
  name: string | null;
  is_hostile: number;
  route_path: string;
  tooltip_rich_text_json: string | null;
}

interface StatusEffectPresentationRecord {
  id: string;
  name: string | null;
  render_context: "status-effect-presentation-v1";
  is_hostile: number;
  tooltip_rich_text_json: string | null;
  route_path: string;
}
export interface StatusEffectOverviewRow {
  id: string;
  name: string | null;
  isHostile: boolean;
  descriptionSummary: string | null;
  displayName: string;
  routePath: string;
}

export interface StatusEffectPresentationRow {
  id: string;
  name: string | null;
  renderContext: "status-effect-presentation-v1";
  description: RichTextDocument | null;
  descriptionText: string | null;
  displayName: string;
  isHostile: boolean;
  routePath: string;
}

export const listStatusEffects = (): StatusEffectOverviewRow[] => {
  const rows = all<StatusEffectOverviewRecord>(
    `SELECT o.id, o.name, o.is_hostile, p.tooltip_rich_text_json, n.route_path
     FROM status_effect_overview_rows o
     LEFT JOIN status_effect_presentation_rows p
       ON p.id = o.id
     JOIN entity_nodes n
       ON n.entity_type = 'status-effect'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    isHostile: row.is_hostile === 1,
    descriptionSummary: row.tooltip_rich_text_json
      ? firstSentence(richTextPlainText(JSON.parse(row.tooltip_rich_text_json) as RichTextDocument))
      : null,
    displayName: statusEffectName(row.name, row.id, row.tooltip_rich_text_json),
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

export const listItemsApplyingStatusEffect = (statusEffectId: string): RelationshipEdge[] =>
  all<{
    source_id: string;
    label: string;
    route_path: string;
    predicate: string;
    edge_label: string;
    weight: number;
    anchor: string | null;
  }>(
    `SELECT e.source_id, n.label, n.route_path, e.predicate,
            e.label AS edge_label, e.weight, e.anchor
     FROM entity_edges e
     JOIN entity_nodes n
       ON n.entity_type = e.source_type
      AND n.entity_id = e.source_id
      AND n.is_public = 1
     WHERE e.source_type = 'item'
       AND e.target_type = 'status-effect'
       AND e.target_id = ?
       AND e.predicate = 'applies'
     ORDER BY n.label, e.source_id`,
    [statusEffectId],
  ).map((row) => ({
    targetType: "item",
    targetId: row.source_id,
    targetLabel: row.label,
    targetRoutePath: row.route_path,
    predicate: row.predicate,
    label: row.edge_label,
    weight: row.weight,
    anchor: row.anchor,
  }));

export const getStatusEffectPresentation = (
  slug: string,
): StatusEffectPresentationRow | undefined => {
  const node = getEntityNodeBySlug("status-effect", slug);
  if (!node) return undefined;
  const row = get<StatusEffectPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.is_hostile, p.tooltip_rich_text_json,
            n.route_path
     FROM status_effect_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'status-effect'
      AND n.entity_id = p.id
      AND n.is_public = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  const description = row.tooltip_rich_text_json
    ? (JSON.parse(row.tooltip_rich_text_json) as RichTextDocument)
    : null;
  return {
    id: row.id,
    name: row.name,
    renderContext: row.render_context,
    description,
    descriptionText: description ? richTextPlainText(description) : null,
    displayName: statusEffectName(row.name, row.id, row.tooltip_rich_text_json),
    isHostile: row.is_hostile === 1,
    routePath: row.route_path,
  };
};

function statusEffectName(name: string | null, id: string, descriptionJson: string | null): string {
  const normalizedName = name?.trim().toLowerCase();
  if (name && normalizedName !== "unnamed status effect") return name;
  const summary = descriptionJson
    ? firstSentence(richTextPlainText(JSON.parse(descriptionJson) as RichTextDocument))
    : null;
  return summary ? `Unnamed status effect · ${summary}` : `Unnamed status effect · ${id}`;
}

function firstSentence(text: string): string | null {
  const sentence = text.match(/^.*?(?:[.!?](?:\s|$)|$)/)?.[0]?.trim() ?? "";
  return sentence || null;
}

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
