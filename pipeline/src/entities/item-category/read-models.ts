import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const ITEM_CATEGORY_READ_MODEL_DDL = `
CREATE TABLE item_category_overview_rows (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  icon_hash                TEXT,
  default_item_icon_hash   TEXT,
  category_color_json      TEXT NOT NULL,
  item_count               INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE item_category_presentation_rows (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  render_context           TEXT NOT NULL,
  icon_hash                TEXT,
  default_item_icon_hash   TEXT,
  category_color_json      TEXT NOT NULL,
  show_in_all_category     INTEGER NOT NULL,
  columns_json             TEXT NOT NULL,
  item_count               INTEGER NOT NULL DEFAULT 0
);
`;

export function emitItemCategoryReadModels(db: Database, routeBase = "/categories"): void {
  db.exec(ITEM_CATEGORY_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO item_category_overview_rows (
      id, name, icon_hash, default_item_icon_hash, category_color_json, item_count
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO item_category_presentation_rows (
      id, name, render_context, icon_hash, default_item_icon_hash, category_color_json,
      show_in_all_category, columns_json, item_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<
      {
        id: string;
        category_name: string;
        icon_hash: string | null;
        default_item_icon_hash: string | null;
        category_color_json: string;
        show_in_all_category: number;
        columns_json: string;
        item_count: number;
      },
      []
    >(
      `SELECT c.id, c.category_name, icon.asset_hash AS icon_hash,
              default_icon.asset_hash AS default_item_icon_hash,
              c.category_color_json, c.show_in_all_category, c.columns_json,
              (
                SELECT COUNT(*)
                FROM items i
                WHERE json_extract(i."categoryRef", '$.guid') = c.id
              ) AS item_count
       FROM item_categories c
       LEFT JOIN asset_refs icon
         ON icon.entity_id = 'item-category'
        AND icon.entity_row_id = c.id
        AND icon.slot = 'iconRef'
        AND icon.asset_kind = 'image'
       LEFT JOIN asset_refs default_icon
         ON default_icon.entity_id = 'item-category'
        AND default_icon.entity_row_id = c.id
        AND default_icon.slot = 'defaultItemIconRef'
        AND default_icon.asset_kind = 'image'
       ORDER BY c.category_name`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      overviewInsert.run(
        row.id,
        row.category_name,
        row.icon_hash,
        row.default_item_icon_hash,
        row.category_color_json,
        row.item_count,
      );
      presentationInsert.run(
        row.id,
        row.category_name,
        "item-category-presentation-v1",
        row.icon_hash,
        row.default_item_icon_hash,
        row.category_color_json,
        row.show_in_all_category,
        row.columns_json,
        row.item_count,
      );
      const slug = deriveEntityNodeSlug(row.category_name, row.id);
      writeNode({
        entityType: "item-category",
        entityId: row.id,
        label: row.category_name,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}
