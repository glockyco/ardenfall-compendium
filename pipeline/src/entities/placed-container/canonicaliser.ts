import type { Database } from "bun:sqlite";
import type {
  PlacedContainerFieldName,
  PlacedContainerSnapshotFields,
} from "../../../dist/entity-fields.mjs";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function placedContainerField<
  K extends PlacedContainerFieldName & keyof PlacedContainerSnapshotFields,
>(fields: PlacedContainerSnapshotFields, key: K): PlacedContainerSnapshotFields[K] {
  return fields[key];
}

export function canonicalisePlacedContainers(db: Database, envelope: SnapshotEnvelope): void {
  const containerInsert = db.prepare(
    `INSERT INTO placed_containers (
      id, cell, map_id, source_position_json, container_name, interaction_text,
      loot_lists_json, additional_items_json, possible_item_refs_json, level_json, lock_json,
      owners_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const rows = [...entityRows<PlacedContainerSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const fields = row.fields;
      const position = placedContainerField(fields, "position");
      const point = sourceToMapPoint(position);
      containerInsert.run(
        row.id,
        placedContainerField(fields, "cell"),
        placedContainerField(fields, "map") ?? null,
        JSON.stringify(position),
        placedContainerField(fields, "containerName"),
        placedContainerField(fields, "interactionText"),
        JSON.stringify(placedContainerField(fields, "lootLists")),
        JSON.stringify(placedContainerField(fields, "additionalItems")),
        JSON.stringify(placedContainerField(fields, "possibleItemRefs")),
        JSON.stringify(placedContainerField(fields, "level")),
        JSON.stringify(placedContainerField(fields, "lock")),
        JSON.stringify(placedContainerField(fields, "owners")),
      );
      placementInsert.run(
        "placed-container",
        row.id,
        placedContainerField(fields, "map") ?? null,
        point.x,
        point.y,
        point.elevation,
        JSON.stringify({ kind: "sceneObject", id: row.id }),
      );
    }
  });
  tx();
}

function compareRows(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
