import type { Database } from "bun:sqlite";
import type { FactionSnapshotFields, SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows } from "../../types.ts";

export function canonicaliseFactions(db: Database, envelope: SnapshotEnvelope): void {
  const factionInsert = db.prepare(
    `INSERT INTO factions (
      id, name, faction_id, description, icon_ref_json, alliable, enable_reputation,
      always_show_in_ui, can_be_disguised, enable_bounty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const relationshipInsert = db.prepare(
    `INSERT INTO faction_relationships (
      id, source_faction_id, target_faction_id, relationship, is_enemy
    ) VALUES (?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of entityRows<FactionSnapshotFields>(envelope)) {
      const fields = row.fields;
      factionInsert.run(
        row.id,
        nullableText(fields.name),
        nullableText(fields.factionId),
        fields.description ?? "",
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
        fields.alliable ? 1 : 0,
        fields.enableReputation ? 1 : 0,
        fields.alwaysShowInUI ? 1 : 0,
        fields.canBeDisguised ? 1 : 0,
        fields.enableBounty ? 1 : 0,
      );

      for (const [index, relationship] of (fields.interFactionRelationships ?? []).entries()) {
        const targetId = resolveFactionId(relationship.faction);
        if (!relationship.isEnemy && relationship.relationship > 0) {
          throw new Error(
            `faction '${row.id}' has a positive relationship of ${relationship.relationship} with faction '${targetId ?? "unknown"}' while isEnemy is false`,
          );
        }
        relationshipInsert.run(
          `${row.id}:relationship:${index}`,
          row.id,
          targetId,
          relationship.relationship,
          relationship.isEnemy ? 1 : 0,
        );
      }
    }
  });
  tx();
}

function nullableText(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function resolveFactionId(ref: SnapshotRef | null | undefined): string | null {
  if (!ref) return null;
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "faction") return `named;faction;${ref.name}`;
  return null;
}
