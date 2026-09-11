import type { Database } from "bun:sqlite";
import type {
  WorldSpawnFieldName,
  WorldSpawnSnapshotFields,
} from "../../../dist/entity-fields.mjs";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function worldSpawnField<K extends WorldSpawnFieldName & keyof WorldSpawnSnapshotFields>(
  fields: WorldSpawnSnapshotFields,
  key: K,
): WorldSpawnSnapshotFields[K] {
  return fields[key];
}

export function canonicaliseWorldSpawns(db: Database, envelope: SnapshotEnvelope): void {
  const spawnInsert = db.prepare(
    `INSERT INTO world_spawns (
      id, cell, map_id, source_position_json, kind, character_ref_json, record_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const rows = [...entityRows<WorldSpawnSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const fields = row.fields;
      const position = worldSpawnField(fields, "position");
      const characterRef = worldSpawnField(fields, "characterRef");
      const recordRef = worldSpawnField(fields, "recordRef");
      const point = sourceToMapPoint(position);
      spawnInsert.run(
        row.id,
        worldSpawnField(fields, "cell"),
        worldSpawnField(fields, "map") ?? null,
        JSON.stringify(position),
        worldSpawnField(fields, "kind"),
        characterRef === null ? null : JSON.stringify(characterRef),
        recordRef === null ? null : JSON.stringify(recordRef),
      );
      placementInsert.run(
        "world-spawn",
        row.id,
        worldSpawnField(fields, "map") ?? null,
        point.x,
        point.y,
        point.elevation,
        JSON.stringify(characterRef ?? recordRef ?? { kind: "missing" }),
      );
    }
  });
  tx();
}

function compareRows(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
