import type { Database } from "bun:sqlite";
import { disambiguateEntityLabel } from "../relationships/entity-links.ts";

/**
 * Persist the label that every consumer should display for an entity node.
 *
 * A label is disambiguated against the labels a reader can reach, meaning nodes
 * that have a page. Counting unreachable nodes would put a suffix on a title
 * that nothing collides with: the race grouping publishes one page per race and
 * keeps its variants as pageless rows, so 109 of them share the label `Karu Elf`
 * while exactly one is reachable under it.
 *
 * The count is still taken once over the whole graph rather than per rendering
 * surface, so a node's label is the same wherever it appears.
 */
export function emitEntityDisplayLabels(db: Database): void {
  const rows = db
    .query<
      {
        entity_type: string;
        entity_id: string;
        label: string | null;
        short_id: string;
        has_page: number;
        label_count: number;
      },
      []
    >(
      `SELECT entity_type, entity_id, label, short_id, has_page,
              COUNT(*) FILTER (WHERE has_page = 1)
                OVER (PARTITION BY entity_type, label) AS label_count
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
      disambiguateEntityLabel(row.label, row.short_id, row.has_page === 1, row.label_count),
      row.entity_type,
      row.entity_id,
    );
  }
}
