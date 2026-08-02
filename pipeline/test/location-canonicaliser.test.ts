import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseLocations, sourceToMapPoint } from "$pipeline/entities/location/canonicaliser";
import { LOCATION_DDL } from "$pipeline/sql/location-ddl";
import type { SnapshotEnvelope } from "$pipeline/types";

const envelope: SnapshotEnvelope = {
  entityId: "location",
  schemaVersion: 1,
  rows: [
    {
      id: "11111111.fixture-town",
      fields: {
        id: "11111111.fixture-town",
        gameLocationId: "town",
        name: "Harbor Town",
        enabled: true,
        mapId: "ardenfall",
        mapRef: { kind: "lookupAsset", guid: "map-guid", unityType: "MapData", name: "Ardenfall" },
        showOnMap: true,
        showOnMapDebugOnly: false,
        iconRef: {
          kind: "missing",
          reason: "not-exported-in-slice-5",
          source: "LocationAsset.icon",
        },
        mapPosition: { x: 12, y: 3, z: -8 },
        allowFastTravel: true,
        fastTravelPosition: { x: 14, y: 4, z: -10 },
        displayOnEnterVolume: true,
        volumes: [
          {
            index: 0,
            center: { x: 10, y: 2, z: -20 },
            size: { x: 6, y: 4, z: 8 },
          },
        ],
      },
    },
  ],
};

describe("sourceToMapPoint", () => {
  it("maps Unity x/z to compendium x/y and preserves elevation", () => {
    expect(sourceToMapPoint({ x: 12, y: 3, z: -8 })).toEqual({ x: 12, y: 8, elevation: 3 });
    expect(sourceToMapPoint({ x: -5, y: -2, z: 9 })).toEqual({ x: -5, y: -9, elevation: -2 });
    expect(sourceToMapPoint({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: -0, elevation: 0 });
  });
});

describe("canonicaliseLocations", () => {
  it("inserts locations and axis-aligned volume geometry", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    canonicaliseLocations(db, envelope);

    const location = db
      .query(
        `SELECT id, game_location_id, name, enabled, map_id, show_on_map,
                show_on_map_debug_only, fast_travel_map_x, fast_travel_map_y,
                fast_travel_elevation
         FROM locations WHERE id = '11111111.fixture-town'`,
      )
      .get() as Record<string, unknown>;

    expect(location).toEqual({
      id: "11111111.fixture-town",
      game_location_id: "town",
      name: "Harbor Town",
      enabled: 1,
      map_id: "ardenfall",
      show_on_map: 1,
      show_on_map_debug_only: 0,
      fast_travel_map_x: 14,
      fast_travel_map_y: 10,
      fast_travel_elevation: 4,
    });

    const placement = db
      .query(
        `SELECT entity_id, instance_id, map_id, map_x, map_y, elevation, geometry_json
         FROM placements WHERE entity_id = 'location' AND instance_id = '11111111.fixture-town'`,
      )
      .get() as Record<string, unknown>;

    expect(placement).toEqual({
      entity_id: "location",
      instance_id: "11111111.fixture-town",
      map_id: "ardenfall",
      map_x: 12,
      map_y: 8,
      elevation: 3,
      geometry_json: null,
    });

    const volume = db
      .query(
        `SELECT id, location_id, volume_index, kind, map_min_x, map_min_y,
                map_max_x, map_max_y, elevation_min, elevation_max, geometry_json
         FROM location_volumes WHERE location_id = '11111111.fixture-town'`,
      )
      .get() as {
      id: string;
      location_id: string;
      volume_index: number;
      kind: string;
      map_min_x: number;
      map_min_y: number;
      map_max_x: number;
      map_max_y: number;
      elevation_min: number;
      elevation_max: number;
      geometry_json: string;
    };

    expect(volume.id).toBe("11111111.fixture-town:volume:0");
    expect(volume.kind).toBe("axis-aligned-box");
    expect(volume.map_min_x).toBe(7);
    expect(volume.map_max_x).toBe(13);
    expect(volume.map_min_y).toBe(16);
    expect(volume.map_max_y).toBe(24);
    expect(volume.elevation_min).toBe(0);
    expect(volume.elevation_max).toBe(4);
    expect(JSON.parse(volume.geometry_json)).toEqual({
      schemaVersion: 1,
      kind: "axis-aligned-box",
      ring: [
        [7, 16],
        [13, 16],
        [13, 24],
        [7, 24],
        [7, 16],
      ],
    });
    const ring = JSON.parse(volume.geometry_json).ring as number[][];
    const signedArea =
      ring.slice(0, -1).reduce((area, point, index) => {
        const next = ring[index + 1];
        if (point === undefined || next === undefined) {
          throw new Error("fixture ring is missing a point");
        }
        const [pointX, pointY] = point;
        const [nextX, nextY] = next;
        if (
          pointX === undefined ||
          pointY === undefined ||
          nextX === undefined ||
          nextY === undefined
        ) {
          throw new Error("fixture ring point is missing a coordinate");
        }
        return area + pointX * nextY - nextX * pointY;
      }, 0) / 2;
    expect(ring[0]).toEqual(ring.at(-1));
    expect(signedArea).toBeGreaterThan(0);
  });

  it("rejects non-finite source coordinates", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    expect(() =>
      canonicaliseLocations(db, {
        entityId: "location",
        schemaVersion: 1,
        rows: [
          {
            id: "bad-location",
            fields: {
              id: "bad-location",
              gameLocationId: "bad",
              name: "Bad",
              enabled: true,
              mapId: "ardenfall",
              showOnMap: true,
              showOnMapDebugOnly: false,
              mapPosition: { x: Number.NaN, y: 0, z: 0 },
              allowFastTravel: false,
              fastTravelPosition: null,
              displayOnEnterVolume: false,
              volumes: [],
            },
          },
        ],
      }),
    ).toThrow(/location 'bad-location' has non-finite mapPosition.x/);
  });

  it("diagnoses negative or degenerate volume sizes without inventing geometry", () => {
    const db = new Database(":memory:");
    db.exec(LOCATION_DDL);

    canonicaliseLocations(db, {
      entityId: "location",
      schemaVersion: 1,
      rows: [
        {
          id: "degenerate-location",
          fields: {
            id: "degenerate-location",
            gameLocationId: "degenerate",
            name: "Degenerate",
            enabled: true,
            mapId: "ardenfall",
            showOnMap: true,
            showOnMapDebugOnly: false,
            mapPosition: { x: 0, y: 0, z: 0 },
            allowFastTravel: false,
            fastTravelPosition: null,
            displayOnEnterVolume: false,
            volumes: [
              { index: 0, center: { x: 0, y: 0, z: 0 }, size: { x: -1, y: 1, z: 1 } },
              { index: 1, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 1, z: 0 } },
            ],
          },
        },
      ],
    });

    const rows = db
      .query(
        "SELECT volume_index, kind, geometry_json, diagnostics_json FROM location_volumes ORDER BY volume_index",
      )
      .all() as {
      volume_index: number;
      kind: string;
      geometry_json: string | null;
      diagnostics_json: string;
    }[];

    const firstRow = rows[0];
    if (firstRow === undefined) throw new Error("expected negative-size volume row");
    expect(firstRow).toEqual({
      volume_index: 0,
      kind: "invalid-axis-aligned-box",
      geometry_json: null,
      diagnostics_json: JSON.stringify([
        { severity: "diagnostic", code: "locationVolumeNegativeSize", field: "volumes[0].size" },
      ]),
    });
    const secondRow = rows[1];
    if (secondRow === undefined) throw new Error("expected degenerate-size volume row");
    expect(secondRow.kind).toBe("degenerate-axis-aligned-box");
    expect(JSON.parse(secondRow.diagnostics_json)).toEqual([
      { severity: "diagnostic", code: "locationVolumeDegenerateSize", field: "volumes[1].size" },
    ]);
  });
});
