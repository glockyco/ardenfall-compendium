import type { Database } from "bun:sqlite";
import type {
  SnapshotEnvelope,
  SnapshotRef,
  SnapshotVector3,
  NPCSnapshotFields,
} from "../../types.ts";
import { entityRows, snapshotRefKey } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function npcField<K extends keyof NPCSnapshotFields>(
  fields: NPCSnapshotFields,
  key: K,
): NPCSnapshotFields[K] {
  return fields[key];
}

export function canonicaliseNpcs(db: Database, envelope: SnapshotEnvelope): void {
  const npcInsert = db.prepare(
    `INSERT INTO npcs (
      id, record_ref_json, display_name, authoring_label, character_ref_json,
      source_spawn_point_json, map_id, drop_refs_json, starting_level_json,
      merchant_refs_json, merchant_gold_json, merchant_categories_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const locationRefInsert = db.prepare(
    `INSERT INTO npc_location_refs (id, npc_id, location_id, ref_json)
     VALUES (?, ?, ?, ?)`,
  );
  const factionRefInsert = db.prepare(
    `INSERT INTO npc_faction_refs (id, npc_id, target_faction_id, ref_json)
     VALUES (?, ?, ?, ?)`,
  );
  const provenanceInsert = db.prepare(
    `INSERT INTO npc_value_provenance (id, npc_id, field_name, provenance, owner)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const rows = [...entityRows<NPCSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const fields = row.fields;
      const recordRef = npcField(fields, "recordRef");
      const spawnPoint = npcField(fields, "spawnPoint");
      const point = sourceToMapPointForNpc(row.id, spawnPoint);
      const displayName = npcField(fields, "displayName");
      const dropRefs = [...npcField(fields, "dropRefs")].sort((left, right) =>
        compareStrings(snapshotRefKey(left), snapshotRefKey(right)),
      );
      const startingFactions = [...npcField(fields, "startingFactions")].sort((left, right) =>
        compareStrings(factionSortKey(left), factionSortKey(right)),
      );
      const merchantRefs = [...npcField(fields, "merchantRefs")].sort((left, right) =>
        compareStrings(snapshotRefKey(left), snapshotRefKey(right)),
      );
      const merchantCategories = [...npcField(fields, "merchantCategories")].sort((left, right) =>
        compareStrings(snapshotRefKey(left), snapshotRefKey(right)),
      );
      const locationRefs = [...(npcField(fields, "containingLocationRefs") ?? [])].sort(
        (left, right) => compareStrings(locationSortKey(left), locationSortKey(right)),
      );

      npcInsert.run(
        row.id,
        JSON.stringify(recordRef),
        displayName?.trim() || null,
        npcField(fields, "authoringLabel")?.trim() || null,
        npcField(fields, "characterRef") ? JSON.stringify(npcField(fields, "characterRef")) : null,
        JSON.stringify(spawnPoint),
        npcField(fields, "mapId") ?? null,
        JSON.stringify(dropRefs),
        npcField(fields, "startingLevel")
          ? JSON.stringify(npcField(fields, "startingLevel"))
          : null,
        JSON.stringify(merchantRefs),
        npcField(fields, "merchantGold") ? JSON.stringify(npcField(fields, "merchantGold")) : null,
        JSON.stringify(merchantCategories),
      );
      placementInsert.run(
        "npc",
        row.id,
        npcField(fields, "mapId") ?? null,
        point.x,
        point.y,
        point.elevation,
        JSON.stringify(recordRef),
      );

      for (const [index, ref] of locationRefs.entries()) {
        locationRefInsert.run(
          `${row.id}:location:${index}`,
          row.id,
          resolveLocationId(ref),
          JSON.stringify(ref),
        );
      }
      for (const [index, ref] of startingFactions.entries()) {
        factionRefInsert.run(
          `${row.id}:starting-faction:${index}`,
          row.id,
          resolveFactionId(ref),
          JSON.stringify(ref),
        );
      }

      const provenance = [
        ["displayName", fields.displayNameProvenance, fields.displayNameOwner],
        ["dropRefs", fields.dropRefsProvenance, fields.dropRefsOwner],
        ["startingFactions", fields.startingFactionsProvenance, fields.startingFactionsOwner],
        ["startingLevel", fields.startingLevelProvenance, fields.startingLevelOwner],
        ["merchantRefs", fields.merchantRefsProvenance, fields.merchantRefsOwner],
        ["merchantGold", fields.merchantGoldProvenance, fields.merchantGoldOwner],
        ["merchantCategories", fields.merchantCategoriesProvenance, fields.merchantCategoriesOwner],
      ] as const;
      for (const [fieldName, provenanceValue, owner] of provenance) {
        provenanceInsert.run(
          `${row.id}:provenance:${fieldName}`,
          row.id,
          fieldName,
          provenanceValue,
          owner?.trim() || null,
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

function locationSortKey(ref: SnapshotRef): string {
  return resolveLocationId(ref) ?? snapshotRefKey(ref);
}

function resolveLocationId(ref: SnapshotRef): string | null {
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "location") {
    return `named;location;${ref.name}`;
  }
  return null;
}

function factionSortKey(ref: SnapshotRef): string {
  return resolveFactionId(ref) ?? snapshotRefKey(ref);
}

function resolveFactionId(ref: SnapshotRef): string | null {
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "faction") {
    return `named;faction;${ref.name}`;
  }
  return null;
}

function sourceToMapPointForNpc(npcId: string, point: SnapshotVector3) {
  try {
    return sourceToMapPoint(point);
  } catch (error) {
    throw new Error(`NPC '${npcId}' has an invalid spawnPoint`, { cause: error });
  }
}
