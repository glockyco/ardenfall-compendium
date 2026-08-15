import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as ReadModels from "../src/lib/server/read-models";

const femaleSetId = "named;name-set;nset_mystelf_female";
const maleSetId = "named;name-set;nset_mystelf_male";

const seed = ({ publishMaleSet = true }: { publishMaleSet?: boolean } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-character-race-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE character_race_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_set_count INTEGER NOT NULL
    );
    CREATE TABLE character_race_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      render_context TEXT NOT NULL,
      name_set_refs_json TEXT NOT NULL
    );
    CREATE TABLE name_set_presentation_rows (
      id TEXT PRIMARY KEY,
      render_context TEXT NOT NULL,
      generation_order INTEGER NOT NULL,
      seeds_json TEXT NOT NULL,
      seed_count INTEGER NOT NULL
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
    INSERT INTO character_race_overview_rows VALUES
      ('race-nameless', 'Unnamed race', 0),
      ('race-karu-elf', 'Karu Elf', 2);
    INSERT INTO character_race_presentation_rows VALUES
      ('race-nameless', 'Unnamed race', 'character-race-presentation-v1', '[]'),
      ('race-karu-elf', 'Karu Elf', 'character-race-presentation-v1',
       '[{"kind":"namedAsset","entity":"name-set","name":"nset_mystelf_female"},{"kind":"namedAsset","entity":"name-set","name":"nset_mystelf_male"}]');
    INSERT INTO name_set_presentation_rows VALUES
      ('${femaleSetId}', 'name-set-presentation-v1', 5,
       '[{"name":"Saya","weight":2},{"name":"Mira","weight":1}]', 2),
      ('${maleSetId}', 'name-set-presentation-v1', 6,
       '[{"name":"Sako","weight":7},{"name":"Taro","weight":3}]', 2);
    INSERT INTO entity_nodes VALUES
      ('character-race', 'race-nameless', 'Unnamed race', 'Unnamed race',
       '/races/unnamed-race--33333333', 'unnamed-race--33333333', '33333333', 1),
      ('character-race', 'race-karu-elf', 'Karu Elf', 'Karu Elf',
       '/races/karu-elf--11111111', 'karu-elf--11111111', '11111111', 1),
      ('character-race', 'race-hidden', 'Hidden race', 'Hidden race',
       '/races/hidden-race--22222222', 'hidden-race--22222222', '22222222', 0);
  `);
  if (!publishMaleSet) db.exec(`DELETE FROM name_set_presentation_rows WHERE id = '${maleSetId}'`);
  db.close();
  return root;
};

const withSeed = async (
  callback: (readModels: typeof ReadModels) => void,
  options: { publishMaleSet?: boolean } = {},
) => {
  const originalCwd = process.cwd();
  const root = seed(options);
  try {
    process.chdir(root);
    // The accessor opens the database from process.cwd(), so import after seeding the temporary root.
    const readModels = await import("../src/lib/server/read-models");
    callback(readModels);
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
};

describe("character race read-model accessors", () => {
  it("lists published races and excludes nodes without pages", async () => {
    await withSeed((readModels) => {
      expect(readModels.listCharacterRaces()).toEqual([
        {
          id: "race-karu-elf",
          name: "Karu Elf",
          nameSetCount: 2,
          routePath: "/races/karu-elf--11111111",
        },
        {
          id: "race-nameless",
          name: "Unnamed race",
          nameSetCount: 0,
          routePath: "/races/unnamed-race--33333333",
        },
      ]);
    });
  });

  it("returns two name sets in authored order with complete weighted seeds", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterRacePresentation("karu-elf--11111111")).toEqual({
        id: "race-karu-elf",
        name: "Karu Elf",
        renderContext: "character-race-presentation-v1",
        nameSetCount: 2,
        nameSets: [
          {
            id: femaleSetId,
            generationOrder: 5,
            seedCount: 2,
            seeds: [
              { name: "Saya", weight: 2 },
              { name: "Mira", weight: 1 },
            ],
          },
          {
            id: maleSetId,
            generationOrder: 6,
            seedCount: 2,
            seeds: [
              { name: "Sako", weight: 7 },
              { name: "Taro", weight: 3 },
            ],
          },
        ],
        routePath: "/races/karu-elf--11111111",
      });
    });
  });

  it("fails when a referenced name set is not published", async () => {
    await withSeed(
      (readModels) => {
        expect(() => readModels.getCharacterRacePresentation("karu-elf--11111111")).toThrow(
          "character race 'race-karu-elf' references 2 name sets, but only 1 are published",
        );
      },
      { publishMaleSet: false },
    );
  });

  it("returns a race whose player-visible name is absent", async () => {
    await withSeed((readModels) => {
      expect(readModels.getCharacterRacePresentation("unnamed-race--33333333")).toMatchObject({
        id: "race-nameless",
        name: "Unnamed race",
        nameSetCount: 0,
        nameSets: [],
      });
    });
  });

  it("does not synthesise a generated example name in vocabulary data", async () => {
    await withSeed((readModels) => {
      const presentation = readModels.getCharacterRacePresentation("karu-elf--11111111");
      expect(presentation).toBeDefined();
      expect(JSON.stringify(presentation)).not.toContain("Saya Sako");
      expect(
        presentation?.nameSets.flatMap((nameSet) => nameSet.seeds.map((seed) => seed.name)),
      ).toEqual(["Saya", "Mira", "Sako", "Taro"]);
    });
  });
});
