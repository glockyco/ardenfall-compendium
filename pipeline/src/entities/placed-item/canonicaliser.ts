import type { Database } from "bun:sqlite";
import type {
  PlacedItemFieldName,
  PlacedItemSnapshotFields,
} from "../../../dist/entity-fields.mjs";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function placedItemField<K extends PlacedItemFieldName & keyof PlacedItemSnapshotFields>(
  fields: PlacedItemSnapshotFields,
  key: K,
): PlacedItemSnapshotFields[K] {
  return fields[key];
}

export function canonicalisePlacedItems(db: Database, envelope: SnapshotEnvelope): void {
  const itemInsert = db.prepare(
    `INSERT INTO placed_items (
      id, cell, map_id, source_position_json, item_ref_json, stack_count,
      durability, durability_ruined, enchantments_json, owners_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const rows = [...entityRows<PlacedItemSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const fields = row.fields;
      const position = placedItemField(fields, "position");
      const itemRef = placedItemField(fields, "itemRef");
      const point = sourceToMapPoint(position);
      itemInsert.run(
        row.id,
        placedItemField(fields, "cell"),
        placedItemField(fields, "map") ?? null,
        JSON.stringify(position),
        JSON.stringify(itemRef),
        placedItemField(fields, "stackCount"),
        placedItemField(fields, "durability"),
        placedItemField(fields, "durabilityRuined") ? 1 : 0,
        JSON.stringify(placedItemField(fields, "enchantments")),
        JSON.stringify(placedItemField(fields, "owners")),
      );
      placementInsert.run(
        "placed-item",
        row.id,
        placedItemField(fields, "map") ?? null,
        point.x,
        point.y,
        point.elevation,
        JSON.stringify(itemRef),
      );
    }
  });
  tx();
}

function compareRows(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
