import { all, assetSrc, colorCss, get } from "../db";
import { isStatReferenceArray, parseGeneratedJson, validateRenderContext } from "../json";
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
  render_context: string;
  icon_hash: string | null;
  icon_color: string | null;
  description: string | null;
  long_description: string | null;
  affects_json: string;
  skill_affects_json: string;
  route_path: string;
}

export interface StatTypeReference {
  label: string;
  routePath: string | null;
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
  affects: StatTypeReference[];
  skillAffects: StatTypeReference[];
  routePath: string;
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
    iconColor: colorCss(row.icon_color, "stat-type", "icon_color", row.id),
    routePath: row.route_path,
  }));

export const getStatTypePresentation = (slug: string): StatTypePresentationRow | undefined => {
  const node = getEntityNodeBySlug("stat-type", slug);
  if (!node) return undefined;
  const row = get<StatTypePresentationRecord>(
    `SELECT id, name, grouping, render_context, icon_hash, icon_color,
            description, long_description, affects_json, skill_affects_json,
            n.route_path
     FROM stat_type_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'stat-type'
      AND n.entity_id = p.id
      AND n.is_public = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    grouping: row.grouping,
    renderContext: validateRenderContext(
      row.render_context,
      "stat-type",
      row.id,
      "stat-type-presentation-v1",
    ),
    iconSrc: assetSrc(row.icon_hash),
    iconColor: colorCss(row.icon_color, "stat-type", "icon_color", row.id),
    description: row.description,
    longDescription: row.long_description,
    affects: parseGeneratedJson(
      row.affects_json,
      "stat-type",
      "affects_json",
      row.id,
      isStatReferenceArray,
    ),
    skillAffects: parseGeneratedJson(
      row.skill_affects_json,
      "stat-type",
      "skill_affects_json",
      row.id,
      isStatReferenceArray,
    ),
    routePath: row.route_path,
  };
};
