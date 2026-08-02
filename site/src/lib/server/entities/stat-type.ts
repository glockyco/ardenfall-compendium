import { all, assetSrc, colorCss, get } from "../db";
import { getEntityNodeBySlug } from "./item";

interface StatTypeOverviewRecord {
  id: string;
  name: string;
  grouping: "attribute" | "skill";
  icon_hash: string | null;
  icon_color: string | null;
  route_path: string;
}

interface StatTypePresentationRecord {
  id: string;
  name: string;
  grouping: "attribute" | "skill";
  render_context: "stat-type-presentation-v1";
  icon_hash: string | null;
  icon_color: string | null;
  description: string | null;
  long_description: string | null;
  affects_json: string;
  skill_affects_json: string;
}

export interface StatTypeOverviewRow {
  id: string;
  name: string;
  grouping: "attribute" | "skill";
  iconSrc: string | null;
  iconColor: string | null;
  routePath: string;
}

export interface StatTypePresentationRow {
  id: string;
  name: string;
  grouping: "attribute" | "skill";
  renderContext: "stat-type-presentation-v1";
  iconSrc: string | null;
  iconColor: string | null;
  description: string | null;
  longDescription: string | null;
  affects: string[];
  skillAffects: string[];
}

export const listStatTypes = (): StatTypeOverviewRow[] =>
  all<StatTypeOverviewRecord>(
    `SELECT o.id, o.name, o.grouping, o.icon_hash, o.icon_color, n.route_path
     FROM stat_type_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'stat-type'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.grouping, o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    grouping: row.grouping,
    iconSrc: assetSrc(row.icon_hash),
    iconColor: colorCss(row.icon_color),
    routePath: row.route_path,
  }));

export const getStatTypePresentation = (slug: string): StatTypePresentationRow | undefined => {
  const node = getEntityNodeBySlug("stat-type", slug);
  if (!node) return undefined;
  const row = get<StatTypePresentationRecord>(
    `SELECT id, name, grouping, render_context, icon_hash, icon_color,
            description, long_description, affects_json, skill_affects_json
     FROM stat_type_presentation_rows
     WHERE id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    grouping: row.grouping,
    renderContext: row.render_context,
    iconSrc: assetSrc(row.icon_hash),
    iconColor: colorCss(row.icon_color),
    description: row.description,
    longDescription: row.long_description,
    affects: JSON.parse(row.affects_json) as string[],
    skillAffects: JSON.parse(row.skill_affects_json) as string[],
  };
};
