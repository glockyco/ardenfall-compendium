import type { Database } from "bun:sqlite";
import type { PortalSnapshotFields, SnapshotEnvelope } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

export function canonicalisePortals(db: Database, envelope: SnapshotEnvelope): void {
  const portalInsert = db.prepare(
    `INSERT INTO portals (
      id, record_ref_json, name, is_accessible, map_id, source_position_json, connected_portal_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, geometry_json, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of envelope.rows as Array<{ id: string; fields: PortalSnapshotFields }>) {
      const fields = row.fields;
      const point = sourceToMapPoint(fields.position);
      portalInsert.run(
        row.id,
        JSON.stringify(fields.recordRef),
        fields.name,
        fields.isAccessible ? 1 : 0,
        fields.mapId ?? null,
        JSON.stringify(fields.position),
        fields.connectedPortalRef ? JSON.stringify(fields.connectedPortalRef) : null,
      );
      placementInsert.run(
        "portal",
        row.id,
        fields.mapId ?? null,
        point.x,
        point.y,
        point.elevation,
        null,
        JSON.stringify(fields.recordRef),
      );
    }
  });
  tx();
}
