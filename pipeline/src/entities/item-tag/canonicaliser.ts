import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope } from "../../types.ts";

export interface ItemTagFields {
  id: string;
  tagName: string;
  description?: string | null;
}

export function canonicaliseItemTags(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(`INSERT INTO item_tags (id, tag_name, description) VALUES (?, ?, ?)`);
  const tx = db.transaction(() => {
    for (const row of envelope.rows as Array<{ id: string; fields: ItemTagFields }>) {
      const fields = row.fields;
      insert.run(row.id, fields.tagName, fields.description ?? "");
    }
  });
  tx();
}
