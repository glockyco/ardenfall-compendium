import type { Database } from "bun:sqlite";
import type { PortalSnapshotFields, SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";
import { sourceToMapPoint } from "../location/canonicaliser.ts";

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
      const point = sourceToMapPoint(fields.position);
      portalInsert.run(
        row.id,
        JSON.stringify(fields.recordRef),
        fields.name ?? null,
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
        JSON.stringify(fields.recordRef),
      );
    }
  });
  tx();
}
