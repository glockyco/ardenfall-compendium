import type { Database } from "bun:sqlite";
import type { CharacterSnapshotFields, SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows } from "../../types.ts";

export function canonicaliseCharacters(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO characters (id, character_name, drop_refs_json)
     VALUES (?, ?, ?)`,
  );
  const factionRefInsert = db.prepare(
    `INSERT INTO character_faction_refs (id, character_id, target_faction_id, ref_json)
     VALUES (?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<CharacterSnapshotFields>(envelope)) {
      insert.run(
        row.id,
        row.fields.name?.trim() ? row.fields.name : null,
        JSON.stringify(row.fields.dropRefs ?? []),
      );
      for (const [index, ref] of (row.fields.startingFactions ?? []).entries()) {
        factionRefInsert.run(
          `${row.id}:starting-faction:${index}`,
          row.id,
          resolveFactionId(ref),
          JSON.stringify(ref),
        );
      }
    }
  });
  tx();
}

function resolveFactionId(ref: SnapshotRef): string | null {
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "faction") return `named;faction;${ref.name}`;
  return null;
}
