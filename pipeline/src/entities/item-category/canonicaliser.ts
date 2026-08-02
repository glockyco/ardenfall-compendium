import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";

export interface ItemCategoryFields {
  id: string;
  categoryName: string;
  iconRef?: unknown;
  defaultItemIconRef?: unknown;
  categoryColor: unknown;
  showInAllCategory: boolean;
  columns?: unknown[];
}

export function canonicaliseItemCategories(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO item_categories (
       id, category_name, icon_ref_json, default_item_icon_ref_json,
       category_color_json, show_in_all_category, columns_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<ItemCategoryFields>(envelope)) {
      const fields = row.fields;
      insert.run(
        row.id,
        fields.categoryName,
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
        fields.defaultItemIconRef ? JSON.stringify(fields.defaultItemIconRef) : null,
        JSON.stringify(fields.categoryColor),
        fields.showInAllCategory ? 1 : 0,
        JSON.stringify(fields.columns ?? []),
      );
    }
  });
  tx();
}
