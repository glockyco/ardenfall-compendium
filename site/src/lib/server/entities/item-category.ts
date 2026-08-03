import { all, assetSrc, get } from "../db";
import { isRecordArray, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface ItemCategoryOverviewRecord {
  id: string;
  name: string;
  icon_hash: string | null;
  default_item_icon_hash: string | null;
  category_color_json: string;
  item_count: number;
  route_path: string;
}

interface ItemCategoryPresentationRecord {
  id: string;
  name: string;
  render_context: string;
  icon_hash: string | null;
  default_item_icon_hash: string | null;
  category_color_json: string;
  show_in_all_category: number;
  columns_json: string;
  item_count: number;
  route_path: string;
}

export interface ItemCategoryOverviewRow {
  id: string;
  name: string;
  iconSrc: string | null;
  defaultItemIconSrc: string | null;
  categoryColor: string;
  itemCount: number;
  routePath: string;
}

export interface ItemCategoryPresentationRow {
  id: string;
  name: string;
  renderContext: "item-category-presentation-v1";
  iconSrc: string | null;
  defaultItemIconSrc: string | null;
  categoryColor: string;
  showInAllCategory: boolean;
  columns: Record<string, unknown>[];
  itemCount: number;
  routePath: string;
}

export const listItemCategories = (): ItemCategoryOverviewRow[] =>
  all<ItemCategoryOverviewRecord>(
    `SELECT o.id, o.name, o.icon_hash, o.default_item_icon_hash,
            o.category_color_json, o.item_count, n.route_path
     FROM item_category_overview_rows o
     JOIN entity_nodes n
       ON n.entity_type = 'item-category'
      AND n.entity_id = o.id
      AND n.has_page = 1
     ORDER BY o.name`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    iconSrc: assetSrc(row.icon_hash),
    defaultItemIconSrc: assetSrc(row.default_item_icon_hash),
    categoryColor: row.category_color_json,
    itemCount: row.item_count,
    routePath: row.route_path,
  }));

export const getItemCategoryPresentation = (
  slug: string,
): ItemCategoryPresentationRow | undefined => {
  const node = getEntityNodeBySlug("item-category", slug);
  if (!node) return undefined;
  const row = get<ItemCategoryPresentationRecord>(
    `SELECT id, name, render_context, icon_hash, default_item_icon_hash,
            category_color_json, show_in_all_category, columns_json, item_count,
            n.route_path
     FROM item_category_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'item-category'
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
      "item-category",
      row.id,
      "item-category-presentation-v1",
    ),
    iconSrc: assetSrc(row.icon_hash),
    defaultItemIconSrc: assetSrc(row.default_item_icon_hash),
    categoryColor: row.category_color_json,
    showInAllCategory: row.show_in_all_category === 1,
    columns: parseGeneratedJson(
      row.columns_json,
      "item-category",
      "columns_json",
      row.id,
      isRecordArray,
    ),
    itemCount: row.item_count,
    routePath: row.route_path,
  };
};
