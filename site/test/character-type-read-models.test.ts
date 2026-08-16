import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-character-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE character_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      name_is_description INTEGER NOT NULL
    );
    CREATE TABLE character_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
      name_is_description INTEGER NOT NULL,
      render_context TEXT NOT NULL,
      drop_refs_json TEXT NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      display_label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    CREATE TABLE entity_relationship_sections (
      section_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      title TEXT NOT NULL, predicate TEXT NOT NULL, sort_order INTEGER NOT NULL,
      edges_json TEXT NOT NULL
    );
    CREATE TABLE entity_edges (
      source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      predicate TEXT NOT NULL
    );
    CREATE TABLE map_points (
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL, map_id TEXT
    );
    CREATE TABLE map_volumes (
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL, map_id TEXT
    );
    INSERT INTO character_overview_rows VALUES
      ('character-zed', 'Zed', 0),
      ('character-ada', 'Ada', 0),
      ('character-nameless', 'Character type', 1);
    INSERT INTO character_presentation_rows VALUES
      ('character-zed', 'Zed', 0, 'character-type-presentation-v1', '[{"label":"Iron Sword","routePath":"/items/iron-sword--44444444"},{"label":"Unnamed item","routePath":null}]'),
      ('character-ada', 'Ada', 0, 'character-type-presentation-v1', '[]'),
      ('character-nameless', 'Character type', 1, 'character-type-presentation-v1', '[]');
    INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
      ('character', 'character-zed', 'Zed', 'Zed',
       '/character-types/zed--11111111', 'zed--11111111', '11111111', 1),
      ('character', 'character-ada', 'Ada', 'Ada',
       '/character-types/ada--22222222', 'ada--22222222', '22222222', 1),
      ('character', 'character-nameless', 'Character type', 'Character type 33333333',
       '/character-types/character-type-33333333--33333333', 'character-type-33333333--33333333', '33333333', 1);
    INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
      ('npc', 'npc-mapped', 'Mapped placement', 'Mapped placement',
       '/characters/mapped-placement--aaaa1111', 'mapped-placement--aaaa1111', 'aaaa1111', 1),
      ('npc', 'npc-unmapped', 'Unmapped placement', 'Unmapped placement',
       '/characters/unmapped-placement--bbbb2222', 'unmapped-placement--bbbb2222', 'bbbb2222', 1);
    INSERT INTO map_points (id, entity_id, instance_id, map_id)
      VALUES ('npc:npc-mapped', 'npc', 'npc-mapped', 'overworld');
    INSERT INTO entity_edges (source_type, source_id, target_type, target_id, predicate) VALUES
      ('npc', 'npc-mapped', 'character', 'character-zed', 'instance_of'),
      ('npc', 'npc-unmapped', 'character', 'character-zed', 'instance_of');
    INSERT INTO entity_relationship_sections VALUES
      ('character-zed:instance_of:inverse:npc', 'character', 'character-zed',
       'Placements', 'instance_of', 12,
       '[{"targetType":"npc","targetId":"npc-mapped","targetLabel":"Mapped placement","targetRoutePath":"/characters/mapped-placement--aaaa1111","targetHasPage":true,"predicate":"instance_of","label":"Character type","weight":1,"anchor":null},{"targetType":"npc","targetId":"npc-unmapped","targetLabel":"Unmapped placement","targetRoutePath":"/characters/unmapped-placement--bbbb2222","targetHasPage":true,"predicate":"instance_of","label":"Character type","weight":1,"anchor":null}]');
    INSERT INTO entity_relationship_sections VALUES
      ('character-ada:found_at', 'character', 'character-ada',
       'Found at', 'found_at', 0,
       '[{"targetType":"location","targetId":"location-shisivi","targetLabel":"Shisivi Wood","targetRoutePath":"/locations/shisivi-wood--11111111","predicate":"found_at","label":"Found at","weight":1,"anchor":null}]');
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

describe("character type read-model accessors", () => {
  it("lists character types in stable name and id order", async () => {
    await withSeed((readModels) => {
      expect(readModels.listCharacterTypes()).toEqual([
        {
          id: "character-ada",
          name: "Ada",
          nameIsDescription: false,
          displayName: "Ada",
          routePath: "/character-types/ada--22222222",
        },
        {
          id: "character-nameless",
          name: "Character type",
          nameIsDescription: true,
          displayName: "Character type 33333333",
          routePath: "/character-types/character-type-33333333--33333333",
        },
        {
          id: "character-zed",
          name: "Zed",
          nameIsDescription: false,
          displayName: "Zed",
          routePath: "/character-types/zed--11111111",
        },
      ]);
    });
  });

  it("lists places where a character is found", async () => {
    await withSeed((readModels) => {
      expect(readModels.listRelationshipSections("character", "character-ada")).toEqual([
        {
          id: "character-ada:found_at",
          title: "Found at",
          predicate: "found_at",
          edges: [
            {
              targetType: "location",
              targetId: "location-shisivi",
              targetLabel: "Shisivi Wood",
              targetRoutePath: "/locations/shisivi-wood--11111111",
              predicate: "found_at",
              label: "Found at",
              weight: 1,
              anchor: null,
            },
          ],
        },
      ]);
    });
  });

  it("resolves one character type by slug and returns undefined for an unknown slug", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterTypePresentation("ada--22222222")).toEqual({
        id: "character-ada",
        name: "Ada",
        nameIsDescription: false,
        renderContext: "character-type-presentation-v1",
        displayName: "Ada",
        drops: [],
        placements: [],
        routePath: "/character-types/ada--22222222",
      });
      expect(readModels.getCharacterTypePresentation("zed--11111111")).toMatchObject({
        drops: [
          { label: "Iron Sword", routePath: "/items/iron-sword--44444444" },
          { label: "Unnamed item", routePath: null },
        ],
        placements: [
          {
            id: "npc-mapped",
            label: "Mapped placement",
            routePath: "/characters/mapped-placement--aaaa1111",
            mapHref: "/map?map=overworld&sel=aaaa1111",
          },
          {
            id: "npc-unmapped",
            label: "Unmapped placement",
            routePath: "/characters/unmapped-placement--bbbb2222",
            mapHref: null,
          },
        ],
      });
      expect(readModels.getCharacterTypePresentation("missing--99999999")).toBeUndefined();
    });
  });

  it("titles a nameless character as a distinct description", async () => {
    await withSeed((readModels) => {
      expect(
        readModels.getCharacterTypePresentation("character-type-33333333--33333333"),
      ).toMatchObject({
        name: "Character type",
        nameIsDescription: true,
        displayName: "Character type 33333333",
      });
    });
  });
});
