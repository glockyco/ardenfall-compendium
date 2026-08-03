import type { Database } from "bun:sqlite";
import type { PortalFieldName, PortalSnapshotFields } from "../../../dist/entity-fields.mjs";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function portalField<K extends PortalFieldName & keyof PortalSnapshotFields>(
  fields: PortalSnapshotFields,
  key: K,
): PortalSnapshotFields[K] {
  return fields[key];
}

export function canonicalisePortals(db: Database, envelope: SnapshotEnvelope): void {
  const portalInsert = db.prepare(
    `INSERT INTO portals (
      id, record_ref_json, name, map_id, source_position_json, connected_portal_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of entityRows<PortalSnapshotFields>(envelope)) {
      const fields = row.fields;
      const position = portalField(fields, "position");
      const recordRef = portalField(fields, "recordRef");
      const point = sourceToMapPoint(position);
      portalInsert.run(
        row.id,
        JSON.stringify(recordRef),
        portalField(fields, "name") ?? null,
        portalField(fields, "mapId") ?? null,
        JSON.stringify(position),
        portalField(fields, "connectedPortalRef")
          ? JSON.stringify(portalField(fields, "connectedPortalRef"))
          : null,
      );
      placementInsert.run(
        "portal",
        row.id,
        portalField(fields, "mapId") ?? null,
        point.x,
        point.y,
        point.elevation,
        JSON.stringify(recordRef),
      );
    }
  });
  tx();
}
