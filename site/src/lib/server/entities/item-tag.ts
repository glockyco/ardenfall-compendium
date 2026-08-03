import { all, get } from "../db";
import { getEntityNodeBySlug } from "./item";

interface ItemTagOverviewRecord {
  id: string;
  name: string;
  description: string;
  item_count: number;
  route_path: string;
}

interface ItemTagPresentationRecord {
  id: string;
  name: string;
  render_context: "item-tag-presentation-v1";
  description: string;
  item_count: number;
  route_path: string;
}

export interface ItemTagOverviewRow {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  routePath: string;
}

export interface ItemTagPresentationRow {
  id: string;
  name: string;
  renderContext: "item-tag-presentation-v1";
  description: string;
  itemCount: number;
  routePath: string;
}

export const listItemTags = (): ItemTagOverviewRow[] =>
  all<ItemTagOverviewRecord>(
    `SELECT o.id, o.name, o.description, o.item_count, n.route_path
     FROM item_tag_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'item-tag'
      AND n.entity_id = o.id
      AND n.is_public = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.item_count,
    routePath: row.route_path,
  }));

export const getItemTagPresentation = (slug: string): ItemTagPresentationRow | undefined => {
  const node = getEntityNodeBySlug("item-tag", slug);
  if (!node) return undefined;
  const row = get<ItemTagPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.description, p.item_count,
            n.route_path
     FROM item_tag_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'item-tag'
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
    description: row.description,
    itemCount: row.item_count,
    routePath: row.route_path,
  };
};
