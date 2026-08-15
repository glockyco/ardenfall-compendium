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

function seedDatabase(): Database {
  const db = new Database(":memory:");
  db.exec(NAME_SET_DDL);
  db.exec(CHARACTER_RACE_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  return db;
}

describe("character race and name set pipeline", () => {
  it("round-trips a named race with its ordered name sets", () => {
    const db = seedDatabase();
    const nameSets: SnapshotEnvelope = {
      entityId: "name-set",
      schemaVersion: 1,
      rows: [
        {
          id: femaleSetId,
          fields: {
            id: femaleSetId,
            seeds: [{ name: "Saya", weight: 2 }],
            generationOrder: 5,
          },
        },
        {
          id: maleSetId,
          fields: {
            id: maleSetId,
            seeds: [{ name: "Sako", weight: 7 }],
            generationOrder: 5,
          },
        },
      ],
    };
    const races: SnapshotEnvelope = {
      entityId: "character-race",
      schemaVersion: 1,
      rows: [
        {
          id: "named;character-race;karu-elf",
          fields: {
            id: "named;character-race;karu-elf",
            raceName: "Karu Elf",
            nameSetRefs: [
              { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_female" },
              { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_male" },
            ],
          },
        },
      ],
    };

    canonicaliseNameSets(db, nameSets);
    canonicaliseCharacterRaces(db, races);
    emitNameSetReadModels(db);
    emitCharacterRaceReadModels(db);

    const race = db
      .query<{ name: string; name_set_refs_json: string }, []>(
        `SELECT name, name_set_refs_json
         FROM character_race_presentation_rows`,
      )
      .get();
    expect(race).toEqual({
      name: "Karu Elf",
      name_set_refs_json: JSON.stringify(races.rows[0]!.fields.nameSetRefs),
    });
    expect(JSON.parse(race!.name_set_refs_json)).toHaveLength(2);
    expect(JSON.parse(race!.name_set_refs_json)).toEqual([
      { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_female" },
      { kind: "namedAsset", entity: "name-set", name: "nset_mystelf_male" },
    ]);
    expect(
      db
        .query<{ entity_type: string; entity_id: string; label: string; route_path: string }, []>(
          `SELECT entity_type, entity_id, label, route_path FROM entity_nodes`,
        )
        .all(),
    ).toEqual([
      {
        entity_type: "character-race",
        entity_id: "named;character-race;karu-elf",
        label: "Karu Elf",
        route_path: "/races/karu-elf--karu-elf",
      },
    ]);
  });

  it("canonicalises a race with no player-visible name", () => {
    const db = seedDatabase();
    canonicaliseCharacterRaces(db, {
      entityId: "character-race",
      schemaVersion: 1,
      rows: [
        {
          id: "named;character-race;race_balati",
          fields: {
            id: "named;character-race;race_balati",
            raceName: null,
            nameSetRefs: [],
          },
        },
      ],
    });

    expect(
      db
        .query<{ id: string; race_name: string | null; name_set_refs_json: string }, []>(
          `SELECT id, race_name, name_set_refs_json FROM character_races`,
        )
        .get(),
    ).toEqual({
      id: "named;character-race;race_balati",
      race_name: null,
      name_set_refs_json: "[]",
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
      rows: [
        {
          id: femaleSetId,
          fields: { id: femaleSetId, seeds, generationOrder: 5 },
        },
      ],
    });
    emitNameSetReadModels(db);

    const row = db
      .query<{ generation_order: number; seeds_json: string; seed_count: number }, []>(
        `SELECT generation_order, seeds_json, seed_count FROM name_set_presentation_rows`,
      )
      .get();
    expect(row).toEqual({
      generation_order: 5,
      seeds_json: JSON.stringify(seeds),
      seed_count: 3,
    });
    expect(JSON.parse(row!.seeds_json)).toEqual(seeds);
  });
});
