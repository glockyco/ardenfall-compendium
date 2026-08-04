import { all, assetSrc, get } from "../db";
import { isRichTextDocument, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";
import type { RichTextDocument } from "./item";

interface StatusEffectOverviewRecord {
  id: string;
  name: string | null;
  is_hostile: number;
  route_path: string;
  display_label: string;
  tooltip_rich_text_json: string | null;
}

interface StatusEffectPresentationRecord {
  id: string;
  name: string | null;
  render_context: string;
  is_hostile: number;
  tooltip_rich_text_json: string | null;
  display_icon_hash: string | null;
  route_path: string;
  display_label: string;
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
  displayIconSrc: string | null;
  routePath: string;
}

export const listStatusEffects = (): StatusEffectOverviewRow[] => {
  const rows = all<StatusEffectOverviewRecord>(
    `SELECT o.id, o.name, o.is_hostile, p.tooltip_rich_text_json, n.route_path, n.display_label
     FROM status_effect_overview_rows o
     LEFT JOIN status_effect_presentation_rows p
       ON p.id = o.id
     JOIN entity_nodes n
       ON n.entity_type = 'status-effect'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name, o.id`,
  ).map((row) => {
    const description = row.tooltip_rich_text_json
      ? parseGeneratedJson(
          row.tooltip_rich_text_json,
          "status-effect",
          "tooltip_rich_text_json",
          row.id,
          isRichTextDocument,
        )
      : null;
    return {
      id: row.id,
      name: row.name,
      isHostile: row.is_hostile === 1,
      descriptionSummary: description ? firstSentence(richTextPlainText(description)) : null,
      displayName: row.display_label,
      routePath: row.route_path,
    };
  });
  return rows;
};

export const getStatusEffectPresentation = (
  slug: string,
): StatusEffectPresentationRow | undefined => {
  const node = getEntityNodeBySlug("status-effect", slug);
  if (!node) return undefined;
  const row = get<StatusEffectPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.is_hostile, p.tooltip_rich_text_json,
            p.display_icon_hash, n.route_path, n.display_label
     FROM status_effect_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'status-effect'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  const description = row.tooltip_rich_text_json
    ? parseGeneratedJson(
        row.tooltip_rich_text_json,
        "status-effect",
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
      "status-effect",
      row.id,
      "status-effect-presentation-v1",
    ),
    description,
    descriptionText: description ? richTextPlainText(description) : null,
    displayName: row.display_label,
    isHostile: row.is_hostile === 1,
    displayIconSrc: assetSrc(row.display_icon_hash),
    routePath: row.route_path,
  };
};

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
