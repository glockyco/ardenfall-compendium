import { all, get } from "../db";
import { getEntityNodeBySlug } from "./item";
import type { RichTextDocument } from "./item";

interface StatusEffectOverviewRecord {
  id: string;
  name: string | null;
  is_hostile: number;
  route_path: string;
}

interface StatusEffectPresentationRecord {
  id: string;
  name: string | null;
  render_context: "status-effect-presentation-v1";
  is_hostile: number;
  tooltip_rich_text_json: string | null;
}

export interface StatusEffectOverviewRow {
  id: string;
  name: string | null;
  isHostile: boolean;
  routePath: string;
}

export interface StatusEffectPresentationRow {
  id: string;
  name: string | null;
  renderContext: "status-effect-presentation-v1";
  description: RichTextDocument | null;
  isHostile: boolean;
}

export const listStatusEffects = (): StatusEffectOverviewRow[] =>
  all<StatusEffectOverviewRecord>(
    `SELECT o.id, o.name, o.is_hostile, n.route_path
     FROM status_effect_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'status-effect'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name, o.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    isHostile: row.is_hostile === 1,
    routePath: row.route_path,
  }));

export const getStatusEffectPresentation = (
  slug: string,
): StatusEffectPresentationRow | undefined => {
  const node = getEntityNodeBySlug("status-effect", slug);
  if (!node) return undefined;
  const row = get<StatusEffectPresentationRecord>(
    `SELECT id, name, render_context, is_hostile, tooltip_rich_text_json
     FROM status_effect_presentation_rows
     WHERE id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    renderContext: row.render_context,
    description: row.tooltip_rich_text_json
      ? (JSON.parse(row.tooltip_rich_text_json) as RichTextDocument)
      : null,
    isHostile: row.is_hostile === 1,
  };
};
