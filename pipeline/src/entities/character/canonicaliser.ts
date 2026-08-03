import type { Database } from "bun:sqlite";
import type { CharacterSnapshotFields, SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";

export function canonicaliseCharacters(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO characters (id, character_name, drop_refs_json)
     VALUES (?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<CharacterSnapshotFields>(envelope)) {
      insert.run(
        row.id,
        row.fields.name?.trim() ? row.fields.name : null,
        JSON.stringify(row.fields.dropRefs ?? []),
      );
    }
  });
  tx();
}
