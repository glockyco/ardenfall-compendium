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
      id, record_ref_json, friendly_name, source_spawn_point_json, map_id
    ) VALUES (?, ?, ?, ?, ?)`,
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

  const tx = db.transaction(() => {
    const rows = [...entityRows<NPCSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const fields = row.fields;
      const recordRef = npcField(fields, "recordRef");
      const spawnPoint = npcField(fields, "spawnPoint");
      const point = sourceToMapPointForNpc(row.id, spawnPoint);
      const friendlyName = npcField(fields, "friendlyName");
      const locationRefs = [...(npcField(fields, "containingLocationRefs") ?? [])].sort(
        (left, right) => compareStrings(locationSortKey(left), locationSortKey(right)),
      );

      npcInsert.run(
        row.id,
        JSON.stringify(recordRef),
        friendlyName?.trim() || null,
        JSON.stringify(spawnPoint),
        npcField(fields, "mapId") ?? null,
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

function sourceToMapPointForNpc(npcId: string, point: SnapshotVector3) {
  try {
    return sourceToMapPoint(point);
  } catch (error) {
    throw new Error(`NPC '${npcId}' has an invalid spawnPoint`, { cause: error });
  }
}
