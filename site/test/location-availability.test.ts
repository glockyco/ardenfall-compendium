import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(import.meta.dir, relativePath), "utf8");
const detailSource = source("../src/lib/components/locations/LocationDetail.svelte");
const mapDetailsSource = source("../src/lib/components/map/DetailsPanel.svelte");

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-location-availability-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE locations (
      id TEXT PRIMARY KEY,
      name TEXT,
      enabled INTEGER NOT NULL,
      map_id TEXT,
      map_ref_json TEXT,
      show_on_map INTEGER NOT NULL,
      show_on_map_debug_only INTEGER NOT NULL,
      icon_ref_json TEXT,
      source_map_position_json TEXT,
      allow_fast_travel INTEGER NOT NULL,
      source_fast_travel_json TEXT
    );
    CREATE TABLE location_volumes (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      volume_index INTEGER NOT NULL,
      map_min_x REAL,
      map_min_y REAL,
      map_max_x REAL,
      map_max_y REAL,
      elevation_min REAL,
      elevation_max REAL,
      geometry_json TEXT
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      display_label TEXT,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    CREATE TABLE map_layers (
      layer_id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      render_kind TEXT NOT NULL,
      source_tables_json TEXT NOT NULL,
      color_json TEXT NOT NULL,
      radius REAL,
      icon TEXT,
      tooltip_fields_json TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      legend_label TEXT NOT NULL,
      z_order INTEGER NOT NULL
    );
    CREATE TABLE map_points (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      name TEXT,
      map_id TEXT,
      map_x REAL NOT NULL,
      map_y REAL NOT NULL,
      elevation REAL NOT NULL,
      enabled INTEGER NOT NULL,
      show_on_map_debug_only INTEGER NOT NULL,
      allow_fast_travel INTEGER NOT NULL
    );
    CREATE TABLE map_volumes (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      map_id TEXT
    );
    CREATE TABLE entity_edges (
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      predicate TEXT NOT NULL
    );
    INSERT INTO locations VALUES
      ('location-disabled', 'Disabled location', 0, 'overworld', NULL, 1, 0, NULL, '{}', 0, NULL),
      ('location-enabled', 'Enabled location', 1, 'overworld', NULL, 1, 0, NULL, '{}', 1, NULL);
    INSERT INTO entity_nodes VALUES
      ('location', 'location-disabled', 'Disabled location', 'Disabled location', '/locations/disabled-location--11111111', 'disabled-location--11111111', '11111111', 1),
      ('location', 'location-enabled', 'Enabled location', 'Enabled location', '/locations/enabled-location--22222222', 'enabled-location--22222222', '22222222', 1);
    INSERT INTO map_layers VALUES
      ('locations', 'location', 'point', '["map_points"]', '[255,255,255,255]', 5, NULL, '[]', '[]', 'Locations', 1);
    INSERT INTO map_points VALUES
      ('location:location-disabled', 'location', 'location-disabled', 'Disabled location', 'overworld', 1, 2, 3, 0, 0, 0),
      ('location:location-enabled', 'location', 'location-enabled', 'Enabled location', 'overworld', 4, 5, 6, 1, 0, 1);
  `);
  db.close();
  return root;
};

describe("location availability notice", () => {
  it("preserves enabled flags on location pages and map points", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listLocations()).toEqual([
        {
          id: "location-disabled",
          name: "Disabled location",
          routePath: "/locations/disabled-location--11111111",
        },
        {
          id: "location-enabled",
          name: "Enabled location",
          routePath: "/locations/enabled-location--22222222",
        },
      ]);
      expect(readModels.getLocationPresentation("disabled-location--11111111")).toMatchObject({
        enabled: false,
      });
      expect(readModels.getLocationPresentation("enabled-location--22222222")).toMatchObject({
        enabled: true,
      });
      expect(
        readModels.getMapView().points.map((point) => [point.instanceId, point.enabled]),
      ).toEqual([
        ["location-disabled", false],
        ["location-enabled", true],
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the shared availability notice on the page and map marker details", () => {
    expect(detailSource).toContain("AvailabilityNotice");
    expect(detailSource).toContain(
      'presentation.enabled ? [] : [{ kind: "disabled", subject: "location" }]',
    );
    expect(mapDetailsSource).toContain("AvailabilityNotice");
    expect(mapDetailsSource).toContain(
      'point.enabled ? [] : [{ kind: "disabled", subject: "location" }]',
    );
  });
});
