import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseCharacterRaces } from "../src/entities/character-race/canonicaliser.ts";
import { emitCharacterRaceReadModels } from "../src/entities/character-race/read-models.ts";
import { canonicaliseNameSets } from "../src/entities/name-set/canonicaliser.ts";
import { emitNameSetReadModels } from "../src/entities/name-set/read-models.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { CHARACTER_RACE_DDL } from "../src/sql/character-race-ddl.ts";
import { NAME_SET_DDL } from "../src/sql/name-set-ddl.ts";
import type { SnapshotEnvelope } from "../src/types.ts";

const femaleSetId = "named;name-set;nset_mystelf_female";
const maleSetId = "named;name-set;nset_mystelf_male";
const race = (
  id: string,
  name: string | null,
  parentRef: object,
  nameSetRefs: object[],
  isSet: boolean,
  owner: string | null = null,
): SnapshotEnvelope["rows"][number] => ({
  id,
  fields: {
    id,
    raceName: name,
    raceNameProvenance: name === null ? "absent" : isSet ? "own" : "inherited",
    raceNameOwner: owner,
    parentRef,
    nameSetRefs,
  },
});

function seedDatabase(): Database {
  const db = new Database(":memory:");
  db.exec(NAME_SET_DDL);
  db.exec(CHARACTER_RACE_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  return db;
}

describe("character race and name set pipeline", () => {
  it("groups variants and includes the name-authoring chain root", () => {
    const db = seedDatabase();
    const nameSets: SnapshotEnvelope = {
      entityId: "name-set",
      schemaVersion: 1,
      rows: [
        {
          id: femaleSetId,
          fields: { id: femaleSetId, seeds: [{ name: "Saya", weight: 2 }], generationOrder: 5 },
        },
        {
          id: maleSetId,
          fields: { id: maleSetId, seeds: [{ name: "Sako", weight: 7 }], generationOrder: 5 },
        },
      ],
    };
    const missing = { kind: "missing", reason: "noParent", source: "ParameterizedObject.parent" };
    const parent = (name: string) => ({ kind: "namedAsset", entity: "character-race", name });
    const races: SnapshotEnvelope = {
      entityId: "character-race",
      schemaVersion: 1,
      rows: [
        race("named;character-race;karu-elf", "Karu Elf", missing, [], true),
        race(
          "named;character-race;karu-elf-female",
          "Karu Elf",
          parent("karu-elf"),
          [
            // Repeated references are valid game data; the page keys this list by position.
            { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_female" },
            { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_female" },
          ],
          false,
          "race_karu_elf",
        ),
        race(
          "named;character-race;karu-elf-male",
          "Karu Elf",
          parent("karu-elf"),
          [{ kind: "namedAsset", entity: "name-set", name: "nset_mystelf_male" }],
          true,
        ),
        race(
          "named;character-race;karu-elf-female-old",
          "Karu Elf",
          parent("karu-elf-female"),
          [],
          false,
          "race_karu_elf",
        ),
        race("named;character-race;nameless", null, missing, [], false),
      ],
    };

    canonicaliseNameSets(db, nameSets);
    canonicaliseCharacterRaces(db, races);
    expect(
      db
        .query(
          `
      SELECT race_id, field_name, provenance, owner
      FROM character_race_value_provenance
      ORDER BY race_id
    `,
        )
        .all(),
    ).toEqual([
      {
        race_id: "named;character-race;karu-elf",
        field_name: "raceName",
        provenance: "own",
        owner: null,
      },
      {
        race_id: "named;character-race;karu-elf-female",
        field_name: "raceName",
        provenance: "inherited",
        owner: "race_karu_elf",
      },
      {
        race_id: "named;character-race;karu-elf-female-old",
        field_name: "raceName",
        provenance: "inherited",
        owner: "race_karu_elf",
      },
      {
        race_id: "named;character-race;karu-elf-male",
        field_name: "raceName",
        provenance: "own",
        owner: null,
      },
      {
        race_id: "named;character-race;nameless",
        field_name: "raceName",
        provenance: "absent",
        owner: null,
      },
    ]);
    emitNameSetReadModels(db);
    emitCharacterRaceReadModels(db);

    expect(
      db.query(`SELECT id, name, variant_count FROM character_race_overview_rows`).all(),
    ).toEqual([{ id: "named;character-race;karu-elf", name: "Karu Elf", variant_count: 4 }]);
    const variants = db
      .query<{ variants_json: string }, []>(
        `SELECT variants_json FROM character_race_presentation_rows`,
      )
      .get();
    const publishedVariants = JSON.parse(variants!.variants_json) as Array<{
      id: string;
      nameSetRefs: object[];
    }>;
    const variantIds = publishedVariants.map((variant) => variant.id);
    expect(variantIds).toEqual([
      "named;character-race;karu-elf",
      "named;character-race;karu-elf-female",
      "named;character-race;karu-elf-female-old",
      "named;character-race;karu-elf-male",
    ]);
    expect(variantIds).toContain("named;character-race;karu-elf");
    const refsOf = (id: string): object[] | undefined =>
      publishedVariants.find((variant) => variant.id === id)?.nameSetRefs;
    // The game lets one variant reference the same name set twice, which is why the
    // page keys its list by position rather than by the referenced id.
    expect(refsOf("named;character-race;karu-elf-female")).toEqual([
      { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_female" },
      { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_female" },
    ]);
    expect(refsOf("named;character-race;karu-elf-male")).toEqual([
      { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_male" },
    ]);
    expect(refsOf("named;character-race;karu-elf-female-old")).toEqual([]);
    expect(
      db
        .query(
          `SELECT entity_id AS id, has_page FROM entity_nodes WHERE entity_type = 'character-race' ORDER BY entity_id`,
        )
        .all(),
    ).toEqual([
      { id: "named;character-race;karu-elf", has_page: 1 },
      { id: "named;character-race;karu-elf-female", has_page: 0 },
      { id: "named;character-race;karu-elf-female-old", has_page: 0 },
      { id: "named;character-race;karu-elf-male", has_page: 0 },
      { id: "named;character-race;nameless", has_page: 0 },
    ]);
  });

  it("publishes a named race with one variant", () => {
    const db = seedDatabase();
    canonicaliseCharacterRaces(db, {
      entityId: "character-race",
      schemaVersion: 1,
      rows: [race("named;character-race;single", "Single Race", { kind: "missing" }, [], true)],
    });
    emitCharacterRaceReadModels(db);
    expect(
      db.query(`SELECT id, name, variant_count FROM character_race_overview_rows`).get(),
    ).toEqual({
      id: "named;character-race;single",
      name: "Single Race",
      variant_count: 1,
    });
  });

  it("retains a nameless race canonically without making a page", () => {
    const db = seedDatabase();
    canonicaliseCharacterRaces(db, {
      entityId: "character-race",
      schemaVersion: 1,
      rows: [race("named;character-race;race_balati", null, { kind: "missing" }, [], false)],
    });
    expect(db.query(`SELECT id, race_name, name_set_refs_json FROM character_races`).get()).toEqual(
      {
        id: "named;character-race;race_balati",
        race_name: null,
        name_set_refs_json: "[]",
      },
    );
    emitCharacterRaceReadModels(db);
    expect(db.query(`SELECT COUNT(*) AS count FROM character_race_overview_rows`).get()).toEqual({
      count: 0,
    });
  });

  it("keeps name-set seed order and authored weights", () => {
    const db = seedDatabase();
    const seeds = [
      { name: "Saya", weight: 2 },
      { name: "Sako", weight: 9 },
      { name: "Mira", weight: 1 },
    ];
    canonicaliseNameSets(db, {
      entityId: "name-set",
      schemaVersion: 1,
      rows: [{ id: femaleSetId, fields: { id: femaleSetId, seeds, generationOrder: 5 } }],
    });
    emitNameSetReadModels(db);
    const row = db
      .query<{ generation_order: number; seeds_json: string; seed_count: number }, []>(
        `SELECT generation_order, seeds_json, seed_count FROM name_set_presentation_rows`,
      )
      .get();
    expect(row).toEqual({ generation_order: 5, seeds_json: JSON.stringify(seeds), seed_count: 3 });
  });
});
