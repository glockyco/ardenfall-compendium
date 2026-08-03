import type { Database } from "bun:sqlite";
import type { CharacterSnapshotFields, SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows, snapshotRefKey } from "../../types.ts";

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
    const rows = [...entityRows<CharacterSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const dropRefs = [...(row.fields.dropRefs ?? [])].sort((left, right) =>
        compareStrings(snapshotRefKey(left), snapshotRefKey(right)),
      );
      const startingFactions = [...(row.fields.startingFactions ?? [])].sort((left, right) =>
        compareStrings(factionSortKey(left), factionSortKey(right)),
      );
      insert.run(
        row.id,
        row.fields.name?.trim() ? row.fields.name : null,
        JSON.stringify(dropRefs),
      );
      for (const [index, ref] of startingFactions.entries()) {
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

function compareRows(left: { id: string }, right: { id: string }): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function factionSortKey(ref: SnapshotRef): string {
  return resolveFactionId(ref) ?? snapshotRefKey(ref);
}

function resolveFactionId(ref: SnapshotRef): string | null {
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "faction") return `named;faction;${ref.name}`;
  return null;
}
