import type { Database } from "bun:sqlite";
import type { LocationFieldName, LocationSnapshotFields } from "../../../dist/entity-fields.mjs";
import type { LocationSnapshotVolume, SnapshotEnvelope, SnapshotVector3 } from "../../types.ts";
import { entityRows } from "../../types.ts";

export function locationField<K extends LocationFieldName & keyof LocationSnapshotFields>(
  fields: LocationSnapshotFields,
  key: K,
): LocationSnapshotFields[K] {
  return fields[key];
}

export interface MapPoint {
  x: number;
  y: number;
  elevation: number;
}

export function sourceToMapPoint(point: SnapshotVector3): MapPoint {
  assertFiniteVector(point, "mapPosition");
  return mapPointUnchecked(point);
}

export function canonicaliseLocations(db: Database, envelope: SnapshotEnvelope): void {
  const placementInsert = db.prepare(
    `INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const locationInsert = db.prepare(
    `INSERT INTO locations (
      id, name, enabled, map_id, map_ref_json,
      show_on_map, show_on_map_debug_only, icon_ref_json,
      source_map_position_json, allow_fast_travel, source_fast_travel_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const volumeInsert = db.prepare(
    `INSERT INTO location_volumes (
      id, location_id, volume_index, kind, source_center_json, source_size_json,
      map_min_x, map_min_y, map_max_x, map_max_y, elevation_min, elevation_max,
      geometry_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    for (const row of entityRows<LocationSnapshotFields>(envelope)) {
      const fields = row.fields;
      const mapPosition = locationField(fields, "mapPosition");
      const fastTravelPosition = locationField(fields, "fastTravelPosition");
      const point = sourceToMapPointForRow(row.id, mapPosition, "mapPosition");
      if (fastTravelPosition) {
        sourceToMapPointForRow(row.id, fastTravelPosition, "fastTravelPosition");
      }

      locationInsert.run(
        row.id,
        locationField(fields, "name"),
        locationField(fields, "enabled") ? 1 : 0,
        locationField(fields, "mapId") ?? null,
        locationField(fields, "mapRef") ? JSON.stringify(locationField(fields, "mapRef")) : null,
        locationField(fields, "showOnMap") ? 1 : 0,
        locationField(fields, "showOnMapDebugOnly") ? 1 : 0,
        locationField(fields, "iconRef") ? JSON.stringify(locationField(fields, "iconRef")) : null,
        JSON.stringify(mapPosition),
        locationField(fields, "allowFastTravel") ? 1 : 0,
        fastTravelPosition ? JSON.stringify(fastTravelPosition) : null,
      );
      placementInsert.run(
        "location",
        row.id,
        locationField(fields, "mapId") ?? null,
        point.x,
        point.y,
        point.elevation,
        JSON.stringify({ kind: "lookupAsset", guid: row.id, unityType: "LocationAsset" }),
      );

      for (const volume of locationField(fields, "volumes")) {
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
        );
      }
    }
  });
  tx();
}

function canonicaliseVolume(locationId: string, volume: LocationSnapshotVolume) {
  assertFiniteVectorForRow(locationId, volume.center, `volumes[${volume.index}].center`);
  assertFiniteVectorForRow(locationId, volume.size, `volumes[${volume.index}].size`);

  if (volume.size.x < 0 || volume.size.y < 0 || volume.size.z < 0) {
    return nullVolume("invalid-axis-aligned-box");
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
  const mapMinY = sourceMinZ;
  const mapMaxY = sourceMaxZ;
  const elevationMin = volume.center.y - halfY;
  const elevationMax = volume.center.y + halfY;

  const kind =
    volume.size.x === 0 || volume.size.z === 0 ? "degenerate-axis-aligned-box" : "axis-aligned-box";
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
  };
}

function nullVolume(kind: string) {
  return {
    kind,
    mapMinX: null,
    mapMinY: null,
    mapMaxX: null,
    mapMaxY: null,
    elevationMin: null,
    elevationMax: null,
    geometry: null,
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

/**
 * Projects a world position onto the top-down map plane.
 *
 * The game's own projection is `WorldMapUI.GlobalPositionToMapPosition`, which takes
 * `(x - centre.x) / division.x` and `(z - centre.z) / division.y` and applies no sign
 * change. `worldMapDivision` is positive on both maps, measured live as (3.00, 3.00) for
 * `overworld` and (2.98, 3.19) for `interior`, so the game's map y rises with world z. The
 * game draws that into a Unity UI rect where y rises up the screen, and the site draws it
 * through a deck.gl `OrthographicView` with `flipY: false`, which also puts y up. So world
 * z maps to map y unchanged. Negating it mirrored every marker north to south against the
 * map a player knows.
 *
 * Scale is deliberately not applied. The site fits bounds, so a uniform factor makes no
 * difference. The two maps do have different x and y divisions, which is a real aspect
 * difference this projection does not yet carry.
 */
function mapPointUnchecked(point: SnapshotVector3): MapPoint {
  return { x: point.x, y: point.z, elevation: point.y };
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
