import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows } from "../../types.ts";

export interface CharacterRaceFields {
  id: string;
  raceName: string | null;
  nameSetRefs?: SnapshotRef[];
}

export function canonicaliseCharacterRaces(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO character_races (id, race_name, name_set_refs_json) VALUES (?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<CharacterRaceFields>(envelope)) {
      const fields = row.fields;
      insert.run(row.id, fields.raceName ?? null, JSON.stringify(fields.nameSetRefs ?? []));
    }
  });
  tx();
}
