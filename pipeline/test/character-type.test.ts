import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { resolveCharacterType } from "../src/entities/character-type.ts";
import { CHARACTER_DDL } from "../src/sql/character-ddl.ts";
import { CHARACTER_RACE_DDL } from "../src/sql/character-race-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";

const raceId = "named;character-race;race_karu_elf";

function ref(entity: string, name: string): string {
  return JSON.stringify({ kind: "namedAsset", entity, name });
}

function missingParentRef(): string {
  return JSON.stringify({ kind: "missing", reason: "noParent", source: "test" });
}

function seedDatabase(): Database {
  const db = new Database(":memory:");
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(CHARACTER_DDL);
  db.exec(CHARACTER_RACE_DDL);
  return db;
}

function insertCharacter(
  db: Database,
  id: string,
  name: string | null,
  parentRef: string,
  raceRef: string | null = null,
): void {
  db.run(
    `INSERT INTO characters (id, character_name, parent_ref_json, race_ref_json, drop_refs_json)
     VALUES (?, ?, ?, ?, '[]')`,
    [id, name, parentRef, raceRef],
  );
}

function publishNode(db: Database, type: string, id: string, label: string, route: string): void {
  db.run(
    `INSERT INTO entity_nodes
       (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [type, id, label, label, route, id, id],
  );
}

describe("character type resolution", () => {
  it("uses a named immediate definition", () => {
    const db = seedDatabase();
    const definitionId = "named;character;darvaki";
    insertCharacter(db, definitionId, "Darvaki", missingParentRef());
    publishNode(db, "character", definitionId, "Darvaki", "/character-types/darvaki");

    expect(resolveCharacterType(db, definitionId)).toEqual({
      id: definitionId,
      label: "Darvaki",
      routePath: "/character-types/darvaki",
    });
    db.close();
  });

  it("falls back to the race when the chain has no named ancestor", () => {
    const db = seedDatabase();
    const definitionId = "named;character;role-preset";
    insertCharacter(
      db,
      definitionId,
      "",
      missingParentRef(),
      ref("character-race", "race_karu_elf"),
    );
    db.run(
      `INSERT INTO character_races (id, race_name, name_set_refs_json, parent_ref_json)
       VALUES (?, ?, '[]', NULL)`,
      [raceId, "Karu Elf"],
    );
    publishNode(db, "character-race", raceId, "Karu Elf", "/races/karu-elf");

    expect(resolveCharacterType(db, definitionId)).toEqual({
      id: raceId,
      label: "Karu Elf",
      routePath: "/races/karu-elf",
    });
    db.close();
  });

  it("finds a named grandparent two levels up", () => {
    const db = seedDatabase();
    const grandparentId = "named;character;named-grandparent";
    const parentId = "named;character;unnamed-parent";
    const definitionId = "named;character;unnamed-definition";
    insertCharacter(db, grandparentId, "Named ancestor", missingParentRef());
    insertCharacter(db, parentId, null, ref("character", "named-grandparent"));
    insertCharacter(db, definitionId, null, ref("character", "unnamed-parent"));
    publishNode(
      db,
      "character",
      grandparentId,
      "Named ancestor",
      "/character-types/named-ancestor",
    );

    expect(resolveCharacterType(db, definitionId)).toEqual({
      id: grandparentId,
      label: "Named ancestor",
      routePath: "/character-types/named-ancestor",
    });
    db.close();
  });

  it("terminates when the prototype chain contains a cycle", () => {
    const db = seedDatabase();
    const firstId = "named;character;cycle-first";
    const secondId = "named;character;cycle-second";
    insertCharacter(db, firstId, null, ref("character", "cycle-second"));
    insertCharacter(db, secondId, null, ref("character", "cycle-first"));

    expect(resolveCharacterType(db, firstId)).toBeNull();
    db.close();
  });

  it("returns nothing when no ancestor or race is named", () => {
    const db = seedDatabase();
    const definitionId = "named;character;nameless";
    insertCharacter(db, definitionId, null, missingParentRef());

    expect(resolveCharacterType(db, definitionId)).toBeNull();
    db.close();
  });
});
