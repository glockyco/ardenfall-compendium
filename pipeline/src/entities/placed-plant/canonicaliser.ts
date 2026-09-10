import type { Database } from "bun:sqlite";
import type {
  PlacedPlantFieldName,
  PlacedPlantSnapshotFields,
} from "../../../dist/entity-fields.mjs";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function placedPlantField<K extends PlacedPlantFieldName & keyof PlacedPlantSnapshotFields>(
  fields: PlacedPlantSnapshotFields,
  key: K,
): PlacedPlantSnapshotFields[K] {
  return fields[key];
}

export function canonicalisePlacedPlants(db: Database, envelope: SnapshotEnvelope): void {
  const plantInsert = db.prepare(
    `INSERT INTO placed_plants (
      id, cell, map_id, source_position_json, item_ref_json,
      item_count, regrow_days, harvest_xp, interaction_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const rows = [...entityRows<PlacedPlantSnapshotFields>(envelope)].sort(compareRows);
    for (const row of rows) {
      const fields = row.fields;
      const position = placedPlantField(fields, "position");
      const itemRef = placedPlantField(fields, "itemRef");
      const point = sourceToMapPoint(position);
      plantInsert.run(
        row.id,
        placedPlantField(fields, "cell"),
        placedPlantField(fields, "map") ?? null,
        JSON.stringify(position),
        JSON.stringify(itemRef),
        placedPlantField(fields, "itemCount"),
        placedPlantField(fields, "regrowDays"),
        placedPlantField(fields, "harvestXp"),
        placedPlantField(fields, "interactionText"),
      );
      placementInsert.run(
        "placed-plant",
        row.id,
        placedPlantField(fields, "map") ?? null,
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
