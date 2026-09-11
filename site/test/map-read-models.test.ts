import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { stagePaths } from "../stage-paths.mjs";

/**
 * Seeds a throwaway SQLite database under a fresh root and returns that root.
 *
 * Tests `process.chdir` into it and then `await import` the read-model module:
 * the import must happen after the chdir because the module resolves
 * `.data/data.sqlite` relative to the working directory at load time, so a
 * static import would bind to the wrong database.
 */
function withDb(seed: (db: Database) => void): string {
  const root = join(
    tmpdir(),
    `ardenfall-map-models-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
  );
  mkdirSync(dirname(stagePaths("fixture", root).database), { recursive: true });
  const db = new Database(stagePaths("fixture", root).database);
  seed(db);
  db.close();
  return root;
}

const baseSchema = `
  CREATE TABLE map_basemaps (
    map_id TEXT PRIMARY KEY, min_x REAL NOT NULL, min_y REAL NOT NULL,
    max_x REAL NOT NULL, max_y REAL NOT NULL, pixels_per_unit REAL NOT NULL,
    cell_size REAL NOT NULL, min_zoom INTEGER NOT NULL, max_zoom INTEGER NOT NULL,
    tile_size INTEGER NOT NULL, index_ref TEXT NOT NULL, game_version TEXT NOT NULL
  );
  CREATE TABLE map_tiles (
    map_id TEXT NOT NULL, zoom INTEGER NOT NULL, tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL, asset_hash TEXT, byte_size INTEGER NOT NULL,
    empty INTEGER NOT NULL, PRIMARY KEY (map_id, zoom, tile_x, tile_y)
  );
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
    enabled INTEGER NOT NULL, show_on_map_debug_only INTEGER NOT NULL,
    allow_fast_travel INTEGER NOT NULL
  );
  CREATE TABLE map_volumes (
    id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
    name TEXT NOT NULL, map_id TEXT, geometry_json TEXT NOT NULL,
    elevation_min REAL, elevation_max REAL
  );
  CREATE TABLE entity_nodes (
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
    display_label TEXT, route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
    has_page INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
  );
  CREATE TABLE entity_edges (
    edge_id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
    target_type TEXT NOT NULL, target_id TEXT NOT NULL, predicate TEXT NOT NULL,
    label TEXT NOT NULL, weight REAL NOT NULL, evidence_json TEXT NOT NULL, anchor TEXT
  );
`;

describe("getMapView", () => {
  it("shapes layers, points (with node short ids), volumes, and per-map bounds", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_basemaps VALUES
          ('ardenfall', 0, 0, 300, 300, 3.4, 150, -1, 2, 512, 'map_tiles', 'demo-build');
        INSERT INTO map_tiles VALUES
          ('ardenfall', 2, 0, 0, '${"a".repeat(64)}', 1234, 0),
          ('ardenfall', 2, 1, 0, NULL, 0, 1);
        INSERT INTO map_layers VALUES
          ('locations', 'location', 'map_points',
           '["map_points","map_volumes"]', 'point-or-polygon', 'location',
           '[120,170,255]', 6, '["name"]', '[]', 'Locations', 0);
        INSERT INTO map_points VALUES
          ('location:11111111.fixture-town', 'location', '11111111.fixture-town',
           'Harbor Town', 'ardenfall', 12, 8, 3, 1, 0, 1);
        INSERT INTO map_volumes VALUES
          ('vol-1', 'location', '11111111.fixture-town', 'Harbor Town', 'ardenfall',
           '{"ring":[[10,6],[14,6],[14,10],[10,10],[10,6]]}', 0, 2);
        INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
          ('location', '11111111.fixture-town', 'Harbor Town', 'Harbor Town',
           '/locations/harbor-town--abc12345', 'harbor-town--abc12345', 'abc12345', 1);
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
          enabled: true,
          debugOnly: false,
          nodeShortId: "abc12345",
          routePath: "/locations/harbor-town--abc12345",
          hasPage: true,
          leadsTo: null,
        },
      ]);
      expect(view.volumes[0]?.ring).toEqual([
        [10, 6],
        [14, 6],
        [14, 10],
        [10, 10],
        [10, 6],
      ]);
      expect(view.volumes[0]).toMatchObject({
        nodeShortId: "abc12345",
        routePath: "/locations/harbor-town--abc12345",
        hasPage: true,
      });
      expect(view.maps).toEqual([
        {
          mapId: "ardenfall",
          label: "Ardenfall",
          bounds: { minX: 10, minY: 6, maxX: 14, maxY: 10 },
          basemap: {
            bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300 },
            pixelsPerUnit: 3.4,
            cellSize: 150,
            minZoom: -1,
            maxZoom: 2,
            tileSize: 512,
            indexRef: "map_tiles",
            tiles: [
              {
                zoom: 2,
                x: 0,
                y: 0,
                assetUrl: `/assets/${"a".repeat(64)}.webp`,
                byteSize: 1234,
                empty: false,
              },
              { zoom: 2, x: 1, y: 0, assetUrl: null, byteSize: 0, empty: true },
            ],
          },
        },
      ]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a page-less character marker selectable by its map short id", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_layers VALUES
          ('npcs', 'npc', 'map_points',
           '["map_points"]', 'point', 'character',
           '[255,200,120]', 4, '["characterName"]', '[]', 'Characters', 80);
        INSERT INTO map_points VALUES
          ('npc:record-1', 'npc', 'record-1', 'Ada', 'overworld', 4, 5, 2, 1, 0, 0);
        INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
          ('npc', 'record-1', 'Ada', 'Ada', '/characters/ada--npc11111',
           'ada--npc11111', 'npc11111', 0);
      `);
    });
    const originalCwd = process.cwd();
    try {
      process.chdir(root);
      const { getMapView } = await import("../src/lib/server/read-models");
      const view = getMapView();
      const point = view.points[0];
      expect(view.layers).toContainEqual({
        layerId: "npcs",
        entityType: "npc",
        renderKind: "point",
        sourceTables: ["map_points"],
        fillColor: [255, 200, 120, 255],
        radius: 4,
        icon: "character",
        tooltipFields: ["characterName"],
        filters: [],
        legendLabel: "Characters",
        zOrder: 80,
      });
      expect(point).toMatchObject({
        entityId: "npc",
        instanceId: "record-1",
        name: "Ada",
        tooltip: "Ada",
        enabled: true,
        nodeShortId: "npc11111",
        routePath: "/characters/ada--npc11111",
        hasPage: false,
      });
      expect(point?.name).not.toContain("record-1");
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("attaches a leads_to destination to its source point and leaves others null", async () => {
    const root = withDb((db) => {
      db.exec(baseSchema);
      db.exec(`
        INSERT INTO map_layers VALUES
          ('portals', 'portal', 'map_points',
           '["map_points"]', 'point', 'portal',
           '[190,150,255]', 5, '["name"]', '[]', 'Portals', 903);
        INSERT INTO map_points VALUES
          ('portal:a', 'portal', 'a', 'Harbor Gate', 'ardenfall', 1, 1, 0, 1, 0, 0),
          ('portal:b', 'portal', 'b', 'Cliff Stair', 'interior', 2, 2, 0, 1, 0, 0),
          ('portal:c', 'portal', 'c', 'Sealed Door', 'ardenfall', 3, 3, 0, 1, 0, 0);
        INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
          ('portal', 'a', 'Harbor Gate', 'Harbor Gate', '/map?map=ardenfall&sel=aaaa1111', 'harbor-gate--aaaa1111', 'aaaa1111', 0),
          ('portal', 'b', 'Cliff Stair', 'Cliff Stair', '/map?map=interior&sel=bbbb2222', 'cliff-stair--bbbb2222', 'bbbb2222', 0),
          ('portal', 'c', 'Sealed Door', 'Sealed Door', '/map?map=ardenfall&sel=cccc3333', 'sealed-door--cccc3333', 'cccc3333', 0);
        INSERT INTO entity_edges VALUES
          ('a:leads_to:portal:b', 'portal', 'a', 'portal', 'b', 'leads_to', 'Leads to', 1, '{}', NULL);
      `);
    });
    const originalCwd = process.cwd();
    try {
      process.chdir(root);
      const { getMapView } = await import("../src/lib/server/read-models");
      const byName = new Map(getMapView().points.map((p) => [p.name, p.leadsTo]));

      // The destination carries the target's own label, so the panel can name
      // where a portal goes without a second lookup.
      expect(byName.get("Harbor Gate")).toEqual({ label: "Cliff Stair", shortId: "bbbb2222" });
      // Directed: the edge exists one way only, so the target does not gain a
      // return link it was never given.
      expect(byName.get("Cliff Stair")).toBeNull();
      expect(byName.get("Sealed Door")).toBeNull();
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
