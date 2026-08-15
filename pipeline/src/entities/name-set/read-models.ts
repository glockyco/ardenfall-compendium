import type { Database } from "bun:sqlite";

export const NAME_SET_READ_MODEL_DDL = `
CREATE TABLE name_set_presentation_rows (
  id               TEXT PRIMARY KEY,
  render_context   TEXT NOT NULL,
  generation_order INTEGER NOT NULL,
  seeds_json       TEXT NOT NULL,
  seed_count       INTEGER NOT NULL
);
`;

interface NameSetRow {
  id: string;
  seeds_json: string;
  generation_order: number;
  seed_count: number;
}

export function emitNameSetReadModels(db: Database): void {
  db.exec(NAME_SET_READ_MODEL_DDL);
  const insert = db.prepare(
    `INSERT INTO name_set_presentation_rows (
      id, render_context, generation_order, seeds_json, seed_count
    ) VALUES (?, ?, ?, ?, ?)`,
  );
  const rows = db
    .query<NameSetRow, []>(
      `SELECT id, seeds_json, generation_order,
              json_array_length(seeds_json) AS seed_count
       FROM name_sets
       ORDER BY id`,
    )
    .all();
  const tx = db.transaction(() => {
    for (const row of rows) {
      insert.run(
        row.id,
        "name-set-presentation-v1",
        row.generation_order,
        row.seeds_json,
        row.seed_count,
      );
    }
  });
  tx();
}
