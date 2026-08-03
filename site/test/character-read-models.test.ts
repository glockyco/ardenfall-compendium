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
      render_context TEXT NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      is_public INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO character_overview_rows VALUES
      ('character-zed', 'Zed'),
      ('character-ada', 'Ada'),
      ('character-nameless', NULL);
    INSERT INTO character_presentation_rows VALUES
      ('character-zed', 'Zed', 'character-presentation-v1'),
      ('character-ada', 'Ada', 'character-presentation-v1'),
      ('character-nameless', NULL, 'character-presentation-v1');
    INSERT INTO entity_nodes VALUES
      ('character', 'character-zed', 'Zed',
       '/characters/zed--11111111', 'zed--11111111', '11111111', 1),
      ('character', 'character-ada', 'Ada',
       '/characters/ada--22222222', 'ada--22222222', '22222222', 1),
      ('character', 'character-nameless', 'Unnamed character',
       '/characters/unnamed-character--33333333', 'unnamed-character--33333333', '33333333', 1);
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
          displayName: "Unnamed character · character-nameless",
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

  it("resolves one character by slug and returns undefined for an unknown slug", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterPresentation("ada--22222222")).toEqual({
        id: "character-ada",
        name: "Ada",
        renderContext: "character-presentation-v1",
        displayName: "Ada",
        routePath: "/characters/ada--22222222",
      });
      expect(readModels.getCharacterPresentation("missing--99999999")).toBeUndefined();
    });
  });

  it("gives a nameless character a distinguishable display name", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterPresentation("unnamed-character--33333333")).toMatchObject({
        name: null,
        displayName: "Unnamed character · character-nameless",
      });
    });
  });
});
