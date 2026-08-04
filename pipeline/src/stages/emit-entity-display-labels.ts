import type { Database } from "bun:sqlite";

/**
 * Persist the label that every consumer should display for an entity node.
 *
 * Labels are grouped across the complete graph, not a filtered list, so the
 * result stays stable wherever a node is rendered.
 */
export function emitEntityDisplayLabels(db: Database): void {
  const rows = db
    .query<
      {
        entity_type: string;
        entity_id: string;
        label: string | null;
        short_id: string;
        label_count: number;
      },
      []
    >(
      `SELECT entity_type, entity_id, label, short_id,
              COUNT(*) OVER (PARTITION BY entity_type, label) AS label_count
       FROM entity_nodes`,
    )
    .all();
  const update = db.prepare(
    `UPDATE entity_nodes
     SET display_label = ?
     WHERE entity_type = ? AND entity_id = ?`,
  );
  for (const row of rows) {
    if (row.label === null) {
      throw new Error(
        `entity node '${row.entity_type}:${row.entity_id}' has no label for display_label`,
      );
    }
    update.run(
      row.label_count > 1 ? `${row.label} · ${row.short_id}` : row.label,
      row.entity_type,
      row.entity_id,
    );
  }
}
