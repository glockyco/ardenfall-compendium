import type { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const ITEM_TAG_READ_MODEL_DDL = `
CREATE TABLE item_tag_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  item_count  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE item_tag_presentation_rows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  render_context  TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  item_count      INTEGER NOT NULL DEFAULT 0
);
`;

export function emitItemTagReadModels(db: Database, routeBase = "/tags"): void {
  db.exec(ITEM_TAG_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO item_tag_overview_rows (id, name, description, item_count) VALUES (?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO item_tag_presentation_rows (
      id, name, render_context, description, item_count
    ) VALUES (?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<
      {
        id: string;
        tag_name: string | null;
        description: string;
        item_count: number;
      },
      []
    >(
      `SELECT t.id, t.tag_name, t.description,
              (
                SELECT COUNT(*)
                FROM item_tag_refs refs
                WHERE refs.tag = t.id
              ) AS item_count
       FROM item_tags t
       ORDER BY t.tag_name`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      const label = row.tag_name?.trim() || "Unnamed tag";
      overviewInsert.run(row.id, label, row.description, row.item_count);
      presentationInsert.run(
        row.id,
        label,
        "item-tag-presentation-v1",
        row.description,
        row.item_count,
      );
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "item-tag",
        entityId: row.id,
        label: label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}
