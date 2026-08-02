import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function withDb(seed: (db: Database) => void): string {
  const root = join(
    tmpdir(),
    `ardenfall-map-models-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
  );
  mkdirSync(join(root, "static"), { recursive: true });
  const db = new Database(join(root, "static", "data.sqlite"));
  seed(db);
  db.close();
  return root;
}

const baseSchema = `
  CREATE TABLE map_layers (
    layer_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_table TEXT NOT NULL,
    source_tables_json TEXT NOT NULL, render_kind TEXT NOT NULL, icon TEXT,
    color_json TEXT NOT NULL, radius REAL, tooltip_fields_json TEXT NOT NULL,
    filters_json TEXT NOT NULL, legend_label TEXT NOT NULL, z_order INTEGER NOT NULL
  );
  CREATE TABLE map_points (
    id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
    name TEXT NOT NULL, map_id TEXT, map_x REAL NOT NULL,
    map_y REAL NOT NULL, elevation REAL NOT NULL,
    show_on_map_debug_only INTEGER NOT NULL, allow_fast_travel INTEGER NOT NULL
  );
  CREATE TABLE map_volumes (
    id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
    name TEXT NOT NULL, map_id TEXT, geometry_json TEXT NOT NULL,
    elevation_min REAL, elevation_max REAL
  );
  CREATE TABLE entity_nodes (
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
    route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
    is_public INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
  );
`;

describe("getMapView", () => {
  it("shapes layers, points (with node short ids), volumes, and per-map bounds", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_layers VALUES
          ('locations', 'location', 'map_points',
           '["map_points","map_volumes"]', 'point-or-polygon', 'location',
           '[120,170,255]', 6, '["name"]', '[]', 'Locations', 0);
        INSERT INTO map_points VALUES
          ('location:11111111.fixture-town', 'location', '11111111.fixture-town',
           'Harbor Town', 'ardenfall', 12, 8, 3, 0, 1);
        INSERT INTO map_volumes VALUES
          ('vol-1', 'location', '11111111.fixture-town', 'Harbor Town', 'ardenfall',
           '{"ring":[[10,6],[14,6],[14,10],[10,10],[10,6]]}', 0, 2);
        INSERT INTO entity_nodes VALUES
          ('location', '11111111.fixture-town', 'Harbor Town',
           '/map?map=ardenfall&sel=abc12345', 'harbor-town--abc12345', 'abc12345', 1);
      `);
    });
    const originalCwd = process.cwd();
    try {
      process.chdir(root);
      const { getMapView } = await import("../src/lib/server/read-models");
      const view = getMapView();

      expect(view.layers).toEqual([
        {
          layerId: "locations",
          entityType: "location",
          renderKind: "point-or-polygon",
          sourceTables: ["map_points", "map_volumes"],
          fillColor: [120, 170, 255, 255],
          radius: 6,
          icon: "location",
          tooltipFields: ["name"],
          filters: [],
          legendLabel: "Locations",
          zOrder: 0,
        },
      ]);
      expect(view.points).toEqual([
        {
          id: "location:11111111.fixture-town",
          entityId: "location",
          instanceId: "11111111.fixture-town",
          layerId: "locations",
          mapId: "ardenfall",
          position: [12, 8, 0],
          elevation: 3,
          name: "Harbor Town",
          tooltip: "Harbor Town",
          debugOnly: false,
          fastTravel: true,
          nodeShortId: "abc12345",
        },
      ]);
      expect(view.volumes[0]?.ring).toEqual([
        [10, 6],
        [14, 6],
        [14, 10],
        [10, 10],
        [10, 6],
      ]);
      expect(view.maps).toEqual([
        {
          mapId: "ardenfall",
          label: "ardenfall",
          bounds: { minX: 10, minY: 6, maxX: 14, maxY: 10 },
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails fast on an unsupported map source table", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_layers VALUES
          ('bad', 'location', 'locations',
           '["locations"]', 'point', NULL, '[1,2,3]', NULL, '[]', '[]', 'Bad', 0);
      `);
    });
    const originalCwd = process.cwd();
    try {
      process.chdir(root);
      const { getMapView } = await import("../src/lib/server/read-models");
      expect(() => getMapView()).toThrow(/must be map_points or map_volumes/i);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
