import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const withDatabase = async (
  prefix: string,
  schema: string,
  callback: (readModels: typeof import("../src/lib/server/read-models")) => void,
) => {
  const originalCwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(schema);
  db.close();
  try {
    process.chdir(root);
    callback(await import("../src/lib/server/read-models"));
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("placed-character and portal site read models", () => {
  it("lists every placed character and disambiguates unnamed labels", async () => {
    await withDatabase(
      "ardenfall-site-placed-character-models-",
      `
        CREATE TABLE quest_character_dialogue_rows (
          id TEXT PRIMARY KEY,
          quest_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          quest_ordinal INTEGER NOT NULL,
          kind TEXT NOT NULL,
          text_json TEXT NOT NULL
        );
        CREATE TABLE npc_presentation_rows (
          id TEXT PRIMARY KEY, name TEXT NOT NULL,
          display_name_provenance TEXT NOT NULL, display_name_owner TEXT,
          render_context TEXT NOT NULL, map_id TEXT, map_x REAL NOT NULL,
          map_y REAL NOT NULL, elevation REAL NOT NULL, location_ids_json TEXT NOT NULL
        );
        CREATE TABLE entity_nodes (
          entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
          display_label TEXT NOT NULL,
          route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
          has_page INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
        );
        CREATE TABLE entity_relationship_sections (
          section_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
          title TEXT NOT NULL, predicate TEXT NOT NULL, sort_order INTEGER NOT NULL,
          edges_json TEXT NOT NULL
        );
        INSERT INTO npc_presentation_rows VALUES
          ('npc-ada', 'Ada', 'own', NULL, 'placed-character-presentation-v1', 'overworld', 1, 2, 3, '[]'),
          ('npc-darvaki-a', 'Darvaki', 'own', NULL, 'placed-character-presentation-v1', 'overworld', 4, 5, 6, '["location-woods"]'),
          ('npc-darvaki-b', 'Darvaki', 'inherited', 'type-darvaki', 'placed-character-presentation-v1', 'overworld', 7, 8, 9, '["location-ruins"]'),
          ('npc-unnamed-a', 'Unnamed character', 'absent', NULL, 'placed-character-presentation-v1', 'overworld', 10, 11, 12, '[]'),
          ('npc-unnamed-b', 'Unnamed character', 'absent', NULL, 'placed-character-presentation-v1', NULL, 13, 14, 15, '[]');
        INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
          ('npc', 'npc-ada', 'Ada', 'Ada', '/placed-characters/ada--11111111', 'ada--11111111', '11111111', 1),
          ('npc', 'npc-darvaki-a', 'Darvaki', 'Darvaki', '/placed-characters/darvaki--44444444', 'darvaki--44444444', '44444444', 1),
          ('npc', 'npc-darvaki-b', 'Darvaki', 'Darvaki', '/placed-characters/darvaki--55555555', 'darvaki--55555555', '55555555', 1),
          ('npc', 'npc-unnamed-a', 'Unnamed character', 'Unnamed character · 22222222', '/placed-characters/unnamed-character--22222222', 'unnamed-character--22222222', '22222222', 1),
          ('npc', 'npc-unnamed-b', 'Unnamed character', 'Unnamed character · 33333333', '/placed-characters/unnamed-character--33333333', 'unnamed-character--33333333', '33333333', 1),
          ('location', 'location-woods', 'Shisivi Wood', 'Shisivi Wood', '/locations/shisivi-wood--66666666', 'shisivi-wood--66666666', '66666666', 1),
          ('location', 'location-ruins', 'Old Ruins', 'Old Ruins', '/locations/old-ruins--77777777', 'old-ruins--77777777', '77777777', 1);
      `,
      (readModels) => {
        const rows = readModels.listPlacedCharacters();
        expect(rows).toHaveLength(5);
        expect(rows.map((row) => row.name)).toEqual([
          "Ada",
          "Darvaki",
          "Darvaki",
          "Unnamed character · 22222222",
          "Unnamed character · 33333333",
        ]);
        expect(rows[1]?.locations).toEqual([
          {
            id: "location-woods",
            label: "Shisivi Wood",
            routePath: "/locations/shisivi-wood--66666666",
          },
        ]);
        expect(rows[2]?.locations).toEqual([
          {
            id: "location-ruins",
            label: "Old Ruins",
            routePath: "/locations/old-ruins--77777777",
          },
        ]);
        expect(rows[0]?.locations).toEqual([]);
      },
    );
  });

  it("resolves named and unnamed placed-character detail rows", async () => {
    await withDatabase(
      "ardenfall-site-placed-character-detail-",
      `
        CREATE TABLE quest_character_dialogue_rows (
          id TEXT PRIMARY KEY,
          quest_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          quest_ordinal INTEGER NOT NULL,
          kind TEXT NOT NULL,
          text_json TEXT NOT NULL
        );
        CREATE TABLE npc_presentation_rows (
          id TEXT PRIMARY KEY, name TEXT NOT NULL,
          display_name_provenance TEXT NOT NULL, display_name_owner TEXT,
          render_context TEXT NOT NULL, map_id TEXT, map_x REAL NOT NULL,
          map_y REAL NOT NULL, elevation REAL NOT NULL, location_ids_json TEXT NOT NULL
        );
        CREATE TABLE entity_nodes (
          entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
          display_label TEXT NOT NULL,
          route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
          has_page INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
        );
        CREATE TABLE map_points (
          id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
          map_id TEXT, map_x REAL NOT NULL, map_y REAL NOT NULL, elevation REAL NOT NULL,
          enabled INTEGER NOT NULL, show_on_map_debug_only INTEGER NOT NULL, allow_fast_travel INTEGER NOT NULL
        );
        CREATE TABLE map_volumes (
          id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
          map_id TEXT, geometry_json TEXT NOT NULL, elevation_min REAL, elevation_max REAL
        );
        INSERT INTO npc_presentation_rows VALUES
          ('npc-ada', 'Ada', 'own', NULL, 'placed-character-presentation-v1', 'overworld', 1, 2, 3, '["location-woods"]'),
          ('npc-inherited', 'Captain', 'inherited', 'preset_captain', 'placed-character-presentation-v1', 'overworld', 4, 5, 6, '[]'),
          ('npc-unnamed', 'Unnamed character', 'absent', NULL, 'placed-character-presentation-v1', NULL, 7, 8, 9, '[]');
        INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
          ('npc', 'npc-ada', 'Ada', 'Ada', '/placed-characters/ada--11111111', 'ada--11111111', '11111111', 1),
          ('npc', 'npc-inherited', 'Captain', 'Captain', '/placed-characters/captain--33333333', 'captain--33333333', '33333333', 1),
          ('npc', 'npc-unnamed', 'Unnamed character', 'Unnamed character', '/placed-characters/unnamed-character--22222222', 'unnamed-character--22222222', '22222222', 1),
          ('location', 'location-woods', 'Shisivi Wood', 'Shisivi Wood', '/locations/shisivi-wood--33333333', 'shisivi-wood--33333333', '33333333', 1);
        INSERT INTO map_points VALUES
          ('npc-ada:point', 'npc', 'npc-ada', 'overworld', 1, 2, 3, 1, 0, 1);
      `,
      (readModels) => {
        expect(readModels.getPlacedCharacterPresentation("ada--11111111")).toMatchObject({
          name: "Ada",
          displayNameProvenance: "own",
          displayNameOwner: null,
          mapLabel: "Overworld",
          mapX: 1,
          mapY: 2,
          locations: [{ label: "Shisivi Wood", routePath: "/locations/shisivi-wood--33333333" }],
          mapHref: "/map?map=overworld&sel=11111111",
        });
        expect(readModels.getPlacedCharacterPresentation("captain--33333333")).toMatchObject({
          name: "Captain",
          displayNameProvenance: "inherited",
          displayNameOwner: "preset_captain",
          mapLabel: "Overworld",
          mapX: 4,
          mapY: 5,
          locations: [],
        });
        expect(
          readModels.getPlacedCharacterPresentation("unnamed-character--22222222"),
        ).toMatchObject({
          name: "Unnamed character",
          displayNameProvenance: "absent",
          displayNameOwner: null,
          mapHref: null,
          locations: [],
        });
      },
    );
  });

  it("links a portal detail row to its connected portal page", async () => {
    await withDatabase(
      "ardenfall-site-portal-models-",
      `
        CREATE TABLE portal_presentation_rows (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, render_context TEXT NOT NULL,
          map_id TEXT, map_x REAL, map_y REAL, elevation REAL,
          connected_portal_id TEXT, connected_portal_name TEXT
        );
        CREATE TABLE entity_nodes (
          entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, label TEXT NOT NULL,
          display_label TEXT NOT NULL,
          route_path TEXT NOT NULL, canonical_slug TEXT NOT NULL, short_id TEXT NOT NULL,
          has_page INTEGER NOT NULL, PRIMARY KEY (entity_type, entity_id)
        );
        CREATE TABLE map_points (
          id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
          map_id TEXT, map_x REAL NOT NULL, map_y REAL NOT NULL, elevation REAL NOT NULL,
          enabled INTEGER NOT NULL, show_on_map_debug_only INTEGER NOT NULL, allow_fast_travel INTEGER NOT NULL
        );
        CREATE TABLE map_volumes (
          id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
          map_id TEXT, geometry_json TEXT NOT NULL, elevation_min REAL, elevation_max REAL
        );
        INSERT INTO portal_presentation_rows VALUES
          ('portal-a', 'Gate A', 'portal-presentation-v1', 'overworld', 10, 20, 30, 'portal-b', 'Gate B'),
          ('portal-b', 'Gate B', 'portal-presentation-v1', 'underground', 40, 50, 60, NULL, NULL);
        INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
          ('portal', 'portal-a', 'Gate A', 'Gate A', '/portals/gate-a--11111111', 'gate-a--11111111', '11111111', 1),
          ('portal', 'portal-b', 'Gate B', 'Gate B', '/portals/gate-b--22222222', 'gate-b--22222222', '22222222', 1);
        INSERT INTO map_points VALUES
          ('portal-a:point', 'portal', 'portal-a', 'overworld', 10, 20, 30, 1, 0, 1);
      `,
      (readModels) => {
        expect(readModels.listPortals()).toHaveLength(2);
        expect(readModels.getPortalPresentation("gate-a--11111111")).toMatchObject({
          name: "Gate A",
          connectedPortal: {
            label: "Gate B",
            routePath: "/portals/gate-b--22222222",
          },
          mapHref: "/map?map=overworld&sel=11111111",
        });
        expect(readModels.getPortalPresentation("gate-b--22222222")).toMatchObject({
          name: "Gate B",
          mapHref: null,
        });
      },
    );
  });
});
