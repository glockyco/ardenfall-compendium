import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows } from "../../types.ts";

export interface CharacterRaceFields {
  id: string;
  raceName: string | null;
  raceNameProvenance: "own" | "inherited" | "absent";
  raceNameOwner: string | null;
  nameSetRefs?: SnapshotRef[];
  parentRef?: SnapshotRef | null;
}

export function canonicaliseCharacterRaces(db: Database, envelope: SnapshotEnvelope): void {
  const raceInsert = db.prepare(
    `INSERT INTO character_races (id, race_name, name_set_refs_json, parent_ref_json)
     VALUES (?, ?, ?, ?)`,
  );
  const provenanceInsert = db.prepare(
    `INSERT INTO character_race_value_provenance (id, race_id, field_name, provenance, owner)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<CharacterRaceFields>(envelope)) {
      const fields = row.fields;
      raceInsert.run(
        row.id,
        fields.raceName?.trim() || null,
        JSON.stringify(fields.nameSetRefs ?? []),
        fields.parentRef == null ? null : JSON.stringify(fields.parentRef),
      );
      provenanceInsert.run(
        `${row.id}:provenance:raceName`,
        row.id,
        "raceName",
        fields.raceNameProvenance,
        fields.raceNameOwner?.trim() || null,
      );
    }
  });
  tx();
}
