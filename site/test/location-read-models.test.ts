import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-location-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE locations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL,
      map_id TEXT, map_ref_json TEXT, show_on_map INTEGER NOT NULL,
      show_on_map_debug_only INTEGER NOT NULL, icon_ref_json TEXT,
      source_map_position_json TEXT NOT NULL, allow_fast_travel INTEGER NOT NULL,
      source_fast_travel_json TEXT
    );
    CREATE TABLE location_volumes (
      id TEXT PRIMARY KEY, location_id TEXT NOT NULL, volume_index INTEGER NOT NULL,
      kind TEXT NOT NULL, source_center_json TEXT NOT NULL, source_size_json TEXT NOT NULL,
      map_min_x REAL, map_min_y REAL, map_max_x REAL, map_max_y REAL,
      elevation_min REAL, elevation_max REAL, geometry_json TEXT, diagnostics_json TEXT NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
      route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO locations VALUES
      ('location-shisivi', 'Shisivi Wood', 1, 'overworld', '{}', 0, 0, NULL, '{}', 1, NULL),
      ('location-disabled', 'Disabled Place', 0, 'overworld', '{}', 1, 0, NULL, '{}', 0, NULL);
    INSERT INTO location_volumes VALUES
      ('location-shisivi:volume:0', 'location-shisivi', 0, 'axis-aligned-box', '{}', '{}',
       -4, 2, 8, 14, -1, 5, '{}', '[]');
    INSERT INTO entity_nodes VALUES
      ('location', 'location-shisivi', 'Shisivi Wood', '/locations/shisivi-wood--11111111',
       'shisivi-wood--11111111', '11111111', 1),
      ('location', 'location-disabled', 'Disabled Place', '/locations/disabled-place--22222222',
       'disabled-place--22222222', '22222222', 1);
  `);
  db.close();
  return root;
};

const withSeed = async (
  callback: (readModels: typeof import("../src/lib/server/read-models")) => void,
) => {
  const originalCwd = process.cwd();
  const root = seed();
  try {
    process.chdir(root);
    const readModels = await import("../src/lib/server/read-models");
    callback(readModels);
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("location read-model accessors", () => {
  it("lists enabled locations even when the map marker is hidden", async () => {
    await withSeed((readModels) => {
      expect(readModels.listLocations()).toEqual([
        {
          id: "location-shisivi",
          name: "Shisivi Wood",
          routePath: "/locations/shisivi-wood--11111111",
        },
      ]);
    });
  });

  it("reads the location facts and returns no row for an unknown slug", async () => {
    await withSeed((readModels) => {
      expect(readModels.getLocationPresentation("shisivi-wood--11111111")).toEqual({
        id: "location-shisivi",
        name: "Shisivi Wood",
        routePath: "/locations/shisivi-wood--11111111",
        mapLabel: "Overworld",
        allowFastTravel: true,
        extent: { width: 12, height: 12 },
        elevation: { min: -1, max: 5 },
      });
      expect(readModels.getLocationPresentation("missing--99999999")).toBeUndefined();
    });
  });
});
