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
      name TEXT
    );
    CREATE TABLE character_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT,
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
    INSERT INTO character_overview_rows VALUES
      ('character-zed', 'Zed'),
      ('character-ada', 'Ada'),
      ('character-nameless', NULL);
    INSERT INTO character_presentation_rows VALUES
      ('character-zed', 'Zed', 'character-presentation-v1', '[{"label":"Iron Sword","routePath":"/items/iron-sword--44444444"},{"label":"Unnamed item","routePath":null}]'),
      ('character-ada', 'Ada', 'character-presentation-v1', '[]'),
      ('character-nameless', NULL, 'character-presentation-v1', '[]');
    INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
      ('character', 'character-zed', 'Zed', 'Zed',
       '/characters/zed--11111111', 'zed--11111111', '11111111', 1),
      ('character', 'character-ada', 'Ada', 'Ada',
       '/characters/ada--22222222', 'ada--22222222', '22222222', 1),
      ('character', 'character-nameless', 'Unnamed character', 'Unnamed character',
       '/characters/unnamed-character--33333333', 'unnamed-character--33333333', '33333333', 1);
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

describe("character read-model accessors", () => {
  it("lists characters in stable name and id order", async () => {
    await withSeed((readModels) => {
      expect(readModels.listCharacters()).toEqual([
        {
          id: "character-nameless",
          name: null,
          displayName: "Unnamed character",
          routePath: "/characters/unnamed-character--33333333",
        },
        {
          id: "character-ada",
          name: "Ada",
          displayName: "Ada",
          routePath: "/characters/ada--22222222",
        },
        {
          id: "character-zed",
          name: "Zed",
          displayName: "Zed",
          routePath: "/characters/zed--11111111",
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

  it("resolves one character by slug and returns undefined for an unknown slug", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterPresentation("ada--22222222")).toEqual({
        id: "character-ada",
        name: "Ada",
        renderContext: "character-presentation-v1",
        displayName: "Ada",
        drops: [],
        routePath: "/characters/ada--22222222",
      });
      expect(readModels.getCharacterPresentation("zed--11111111")).toMatchObject({
        drops: [
          { label: "Iron Sword", routePath: "/items/iron-sword--44444444" },
          { label: "Unnamed item", routePath: null },
        ],
      });
      expect(readModels.getCharacterPresentation("missing--99999999")).toBeUndefined();
    });
  });

  it("names a nameless character without exposing its identifier", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterPresentation("unnamed-character--33333333")).toMatchObject({
        name: null,
        displayName: "Unnamed character",
      });
      expect(
        readModels.getCharacterPresentation("unnamed-character--33333333")?.displayName,
      ).not.toContain("33333333");
    });
  });
});
