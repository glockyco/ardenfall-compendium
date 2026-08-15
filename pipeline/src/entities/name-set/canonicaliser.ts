import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";

export interface NameSetSeed {
  name: string;
  weight: number;
}

export interface NameSetFields {
  id: string;
  seeds?: NameSetSeed[];
  generationOrder: number;
}

export function canonicaliseNameSets(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO name_sets (id, seeds_json, generation_order) VALUES (?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<NameSetFields>(envelope)) {
      const fields = row.fields;
      insert.run(row.id, JSON.stringify(fields.seeds ?? []), fields.generationOrder);
    }
  });
  tx();
}
