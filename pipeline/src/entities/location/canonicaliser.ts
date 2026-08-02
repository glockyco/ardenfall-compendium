import type { Database } from "bun:sqlite";
import type {
  LocationSnapshotFields,
  LocationSnapshotVolume,
  SnapshotEnvelope,
  SnapshotVector3,
} from "../../types.ts";
import { entityRows } from "../../types.ts";

export interface MapPoint {
  x: number;
  y: number;
  elevation: number;
}

interface VolumeDiagnostic {
  severity: "diagnostic";
  code: "locationVolumeNegativeSize" | "locationVolumeDegenerateSize";
  field: string;
}

export function sourceToMapPoint(point: SnapshotVector3): MapPoint {
  assertFiniteVector(point, "mapPosition");
  return mapPointUnchecked(point);
}

export function canonicaliseLocations(db: Database, envelope: SnapshotEnvelope): void {
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, geometry_json, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const locationInsert = db.prepare(
    `INSERT INTO locations (
      id, game_location_id, name, enabled, map_id, map_ref_json,
      show_on_map, show_on_map_debug_only, icon_ref_json,
      source_map_position_json, allow_fast_travel, source_fast_travel_json,
      fast_travel_map_x, fast_travel_map_y, fast_travel_elevation, display_on_enter_volume
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const volumeInsert = db.prepare(
    `INSERT INTO location_volumes (
      id, location_id, volume_index, kind, source_center_json, source_size_json,
      map_min_x, map_min_y, map_max_x, map_max_y, elevation_min, elevation_max,
      geometry_json, diagnostics_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of entityRows<LocationSnapshotFields>(envelope)) {
      const fields = row.fields;
      const point = sourceToMapPointForRow(row.id, fields.mapPosition, "mapPosition");
      const fastTravel = fields.fastTravelPosition
        ? sourceToMapPointForRow(row.id, fields.fastTravelPosition, "fastTravelPosition")
        : null;

      locationInsert.run(
        row.id,
        fields.gameLocationId,
        fields.name,
        fields.enabled ? 1 : 0,
        fields.mapId ?? null,
        fields.mapRef ? JSON.stringify(fields.mapRef) : null,
        fields.showOnMap ? 1 : 0,
        fields.showOnMapDebugOnly ? 1 : 0,
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
        JSON.stringify(fields.mapPosition),
        fields.allowFastTravel ? 1 : 0,
        fields.fastTravelPosition ? JSON.stringify(fields.fastTravelPosition) : null,
        fastTravel?.x ?? null,
        fastTravel?.y ?? null,
        fastTravel?.elevation ?? null,
        fields.displayOnEnterVolume ? 1 : 0,
      );
      placementInsert.run(
        "location",
        row.id,
        fields.mapId ?? null,
        point.x,
        point.y,
        point.elevation,
        null,
        JSON.stringify({ kind: "lookupAsset", guid: row.id, unityType: "LocationAsset" }),
      );

      for (const volume of fields.volumes) {
        const canonical = canonicaliseVolume(row.id, volume);
        volumeInsert.run(
          `${row.id}:volume:${volume.index}`,
          row.id,
          volume.index,
          canonical.kind,
          JSON.stringify(volume.center),
          JSON.stringify(volume.size),
          canonical.mapMinX,
          canonical.mapMinY,
          canonical.mapMaxX,
          canonical.mapMaxY,
          canonical.elevationMin,
          canonical.elevationMax,
          canonical.geometry ? JSON.stringify(canonical.geometry) : null,
          JSON.stringify(canonical.diagnostics),
        );
      }
    }
  });
  tx();
}

function canonicaliseVolume(locationId: string, volume: LocationSnapshotVolume) {
  assertFiniteVectorForRow(locationId, volume.center, `volumes[${volume.index}].center`);
  assertFiniteVectorForRow(locationId, volume.size, `volumes[${volume.index}].size`);

  const diagnostics: VolumeDiagnostic[] = [];
  if (volume.size.x < 0 || volume.size.y < 0 || volume.size.z < 0) {
    diagnostics.push({
      severity: "diagnostic",
      code: "locationVolumeNegativeSize",
      field: `volumes[${volume.index}].size`,
    });
    return nullVolume("invalid-axis-aligned-box", diagnostics);
  }

  const halfX = volume.size.x / 2;
  const halfY = volume.size.y / 2;
  const halfZ = volume.size.z / 2;
  const sourceMinX = volume.center.x - halfX;
  const sourceMaxX = volume.center.x + halfX;
  const sourceMinZ = volume.center.z - halfZ;
  const sourceMaxZ = volume.center.z + halfZ;
  const mapMinX = sourceMinX;
  const mapMaxX = sourceMaxX;
  const mapMinY = -sourceMaxZ;
  const mapMaxY = -sourceMinZ;
  const elevationMin = volume.center.y - halfY;
  const elevationMax = volume.center.y + halfY;

  if (volume.size.x === 0 || volume.size.z === 0) {
    diagnostics.push({
      severity: "diagnostic",
      code: "locationVolumeDegenerateSize",
      field: `volumes[${volume.index}].size`,
    });
  }

  const kind = diagnostics.length > 0 ? "degenerate-axis-aligned-box" : "axis-aligned-box";
  const geometry = {
    schemaVersion: 1,
    kind: "axis-aligned-box",
    ring: [
      [mapMinX, mapMinY],
      [mapMaxX, mapMinY],
      [mapMaxX, mapMaxY],
      [mapMinX, mapMaxY],
      [mapMinX, mapMinY],
    ],
  };

  return {
    kind,
    mapMinX,
    mapMinY,
    mapMaxX,
    mapMaxY,
    elevationMin,
    elevationMax,
    geometry,
    diagnostics,
  };
}

function nullVolume(kind: string, diagnostics: VolumeDiagnostic[]) {
  return {
    kind,
    mapMinX: null,
    mapMinY: null,
    mapMaxX: null,
    mapMaxY: null,
    elevationMin: null,
    elevationMax: null,
    geometry: null,
    diagnostics,
  };
}

function sourceToMapPointForRow(
  locationId: string,
  point: SnapshotVector3,
  field: string,
): MapPoint {
  assertFiniteVectorForRow(locationId, point, field);
  return mapPointUnchecked(point);
}

function mapPointUnchecked(point: SnapshotVector3): MapPoint {
  return { x: point.x, y: -point.z, elevation: point.y };
}

function assertFiniteVector(point: SnapshotVector3, field: string): void {
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isFinite(point[axis])) throw new Error(`${field}.${axis} must be finite`);
  }
}

function assertFiniteVectorForRow(locationId: string, point: SnapshotVector3, field: string): void {
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isFinite(point[axis])) {
      throw new Error(`location '${locationId}' has non-finite ${field}.${axis}`);
    }
  }
}
