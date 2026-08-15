import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseCharacters } from "../src/entities/character/canonicaliser.ts";
import { emitCharacterReadModels } from "../src/entities/character/read-models.ts";
import { emitRelationshipSections } from "../src/relationships/relationship-sections.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { CHARACTER_DDL } from "../src/sql/character-ddl.ts";
import type { SnapshotEnvelope, SnapshotRef } from "../src/types.ts";

const itemId = "4ed20218.fixture-iron-sword";
const templateItemId = "a7000001.fixture-base-ring";
const missingPresentationItemId = "a7000002.fixture-missing-presentation";
const characterId = "named;character;character_bandit";
const raceRef: SnapshotRef = {
  kind: "namedAsset",
  entity: "character-race",
  name: "race_karu_elf",
};

function missingParentRef(): SnapshotRef {
  return { kind: "missing", reason: "noParent", source: "test" };
}

function seedDatabase(): Database {
  const db = new Database(":memory:");
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(CHARACTER_DDL);
  db.run(
    `INSERT INTO entity_nodes
        (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', ?, 'Iron Sword', 'Iron Sword', '/items/iron-sword--4ed20218', 'iron-sword--4ed20218', '4ed20218', 1)`,
    [itemId],
  );
  db.exec(
    `CREATE TABLE item_presentation_rows (id TEXT PRIMARY KEY, name_is_placeholder INTEGER NOT NULL)`,
  );
  db.run(`INSERT INTO item_presentation_rows (id, name_is_placeholder) VALUES (?, 0)`, [itemId]);
  db.run(
    `INSERT INTO entity_nodes
        (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', ?, 'Unnamed item — Ring', 'Unnamed item — Ring', '/items/base-ring--a7000001', 'a7000001', 'a7000001', 1)`,
    [templateItemId],
  );
  db.run(`INSERT INTO item_presentation_rows (id, name_is_placeholder) VALUES (?, 1)`, [
    templateItemId,
  ]);
  db.run(
    `INSERT INTO entity_nodes
        (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', ?, 'Missing presentation', 'Missing presentation', '/items/missing-presentation--a7000002', 'a7000002', 'a7000002', 1)`,
    [missingPresentationItemId],
  );
  return db;
}

function canonicalCharacterRows(envelope: SnapshotEnvelope) {
  const db = seedDatabase();
  canonicaliseCharacters(db, envelope);
  const rows = {
    characters: db
      .query(`SELECT id, character_name, race_ref_json, drop_refs_json FROM characters`)
      .all(),
    factions: db
      .query(
        `SELECT id, character_id, target_faction_id, ref_json
         FROM character_faction_refs`,
      )
      .all(),
  };
  db.close();
  return rows;
}

describe("character pipeline", () => {
  it("canonicalises character rows and emits a resolvable can_drop edge", () => {
    const db = seedDatabase();
    canonicaliseCharacters(db, {
      entityId: "character",
      schemaVersion: 1,
      rows: [
        {
          id: characterId,
          fields: {
            id: characterId,
            name: "Bandit",
            parentRef: missingParentRef(),
            raceRef,
            dropRefs: [{ kind: "lookupAsset", guid: itemId }],
          },
        },
      ],
    });

    expect(
      db.query(`SELECT id, character_name, race_ref_json, drop_refs_json FROM characters`).get(),
    ).toEqual({
      id: characterId,
      character_name: "Bandit",
      race_ref_json: JSON.stringify(raceRef),
      drop_refs_json: JSON.stringify([{ kind: "lookupAsset", guid: itemId }]),
    });
    expect(emitCharacterReadModels(db, "/character-types")).toEqual([]);
    expect(db.query(`SELECT name, drop_refs_json FROM character_presentation_rows`).get()).toEqual({
      name: "Bandit",
      drop_refs_json: JSON.stringify([
        { label: "Iron Sword", routePath: "/items/iron-sword--4ed20218" },
      ]),
    });
    expect(
      db
        .query(
          `SELECT edge_id, source_type, target_type, target_id, predicate, label, evidence_json FROM entity_edges`,
        )
        .all(),
    ).toEqual([
      {
        edge_id: `${characterId}:can_drop:item:${itemId}`,
        source_type: "character",
        target_type: "item",
        target_id: itemId,
        predicate: "can_drop",
        label: "Can drop",
        evidence_json: JSON.stringify({ source: "characters.itemLists" }),
      },
    ]);
  });

  it("links a template loot target and keeps its diagnostic", () => {
    const db = seedDatabase();
    canonicaliseCharacters(db, {
      entityId: "character",
      schemaVersion: 1,
      rows: [
        {
          id: characterId,
          fields: {
            id: characterId,
            name: "Bandit",
            parentRef: missingParentRef(),
            raceRef: null,
            dropRefs: [{ kind: "lookupAsset", guid: templateItemId }],
          },
        },
      ],
    });

    expect(emitCharacterReadModels(db, "/character-types")).toEqual([
      expect.objectContaining({ code: "itemLootReferencesPrototype" }),
    ]);
    expect(
      db
        .query(
          `SELECT target_id FROM entity_edges
           WHERE source_id = ? AND predicate = 'can_drop'`,
        )
        .all(characterId),
    ).toEqual([{ target_id: templateItemId }]);
    db.close();
  });

  it("diagnoses a loot target with no item presentation row", () => {
    const db = seedDatabase();
    canonicaliseCharacters(db, {
      entityId: "character",
      schemaVersion: 1,
      rows: [
        {
          id: characterId,
          fields: {
            id: characterId,
            name: "Bandit",
            parentRef: missingParentRef(),
            raceRef: null,
            dropRefs: [{ kind: "lookupAsset", guid: missingPresentationItemId }],
          },
        },
      ],
    });

    expect(emitCharacterReadModels(db, "/character-types")).toEqual([
      expect.objectContaining({ code: "itemLootPresentationMissing" }),
    ]);
    expect(
      db
        .query(
          `SELECT target_id FROM entity_edges
           WHERE source_id = ? AND predicate = 'can_drop'`,
        )
        .all(characterId),
    ).toEqual([{ target_id: missingPresentationItemId }]);
    db.close();
  });

  it("uses an unnamed label for a nameless character", () => {
    const db = seedDatabase();
    canonicaliseCharacters(db, {
      entityId: "character",
      schemaVersion: 1,
      rows: [
        {
          id: characterId,
          fields: {
            id: characterId,
            name: null,
            parentRef: missingParentRef(),
            raceRef: null,
            dropRefs: [],
          },
        },
      ],
    });

    expect(emitCharacterReadModels(db, "/character-types")).toEqual([]);
    expect(db.query(`SELECT name FROM character_overview_rows`).get()).toEqual({
      name: "Unnamed character",
    });
    expect(db.query(`SELECT name FROM character_presentation_rows`).get()).toEqual({
      name: "Unnamed character",
    });
  });

  it("treats a whitespace-only character name as unnamed", () => {
    const db = seedDatabase();
    db.run(
      `INSERT INTO characters (id, character_name, parent_ref_json, race_ref_json, drop_refs_json) VALUES (?, ?, ?, ?, ?)`,
      [characterId, " \t ", JSON.stringify(missingParentRef()), null, "[]"],
    );

    expect(emitCharacterReadModels(db, "/character-types")).toEqual([]);
    expect(db.query(`SELECT name FROM character_overview_rows`).get()).toEqual({
      name: "Unnamed character",
    });
    expect(db.query(`SELECT name FROM character_presentation_rows`).get()).toEqual({
      name: "Unnamed character",
    });
  });

  it("canonicalises reference collections independent of arrival order", () => {
    const dropRefs: SnapshotRef[] = [
      { kind: "lookupAsset", guid: "item-b" },
      { kind: "lookupAsset", guid: "item-a" },
    ];
    const startingFactions: SnapshotRef[] = [
      { kind: "lookupAsset", guid: "faction-b" },
      { kind: "lookupAsset", guid: "faction-a" },
    ];
    const forward: SnapshotEnvelope = {
      entityId: "character",
      schemaVersion: 1,
      rows: [
        {
          id: characterId,
          fields: {
            id: characterId,
            name: "Bandit",
            parentRef: missingParentRef(),
            raceRef: null,
            dropRefs,
            startingFactions,
          },
        },
      ],
    };
    const reversed: SnapshotEnvelope = {
      ...forward,
      rows: [
        {
          ...forward.rows[0]!,
          fields: {
            ...forward.rows[0]!.fields,
            dropRefs: [...dropRefs].reverse(),
            startingFactions: [...startingFactions].reverse(),
          },
        },
      ],
    };

    expect(canonicalCharacterRows(reversed)).toEqual(canonicalCharacterRows(forward));
  });

  it("emits starts_in_faction edges for each starting faction", () => {
    const db = seedDatabase();
    db.run(
      `INSERT INTO entity_nodes
         (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES ('faction', ?, 'Black Moth', 'Black Moth', '/factions/black-moth--a1000001', 'black-moth--a1000001', 'a1000001', 1)`,
      ["a1000001.fixture-black-moth"],
    );
    db.run(
      `INSERT INTO entity_nodes
         (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES ('faction', ?, 'Mages Guild', 'Mages Guild', '/factions/mages-guild--a1000002', 'mages-guild--a1000002', 'a1000002', 1)`,
      ["a1000002.fixture-mages-guild"],
    );
    canonicaliseCharacters(db, {
      entityId: "character",
      schemaVersion: 1,
      rows: [
        {
          id: characterId,
          fields: {
            id: characterId,
            name: "Bandit",
            parentRef: missingParentRef(),
            raceRef: null,
            dropRefs: [],
            startingFactions: [
              { kind: "lookupAsset", guid: "a1000001.fixture-black-moth" },
              { kind: "lookupAsset", guid: "a1000002.fixture-mages-guild" },
            ],
          },
        },
      ],
    });

    expect(emitCharacterReadModels(db, "/character-types")).toEqual([]);
    expect(
      db
        .query(
          `SELECT source_id, target_id, predicate, label, evidence_json
           FROM entity_edges WHERE predicate = 'starts_in_faction' ORDER BY target_id`,
        )
        .all(),
    ).toEqual([
      {
        source_id: characterId,
        target_id: "a1000001.fixture-black-moth",
        predicate: "starts_in_faction",
        label: "Starts in faction",
        evidence_json: JSON.stringify({ source: "characters.startingFactions" }),
      },
      {
        source_id: characterId,
        target_id: "a1000002.fixture-mages-guild",
        predicate: "starts_in_faction",
        label: "Starts in faction",
        evidence_json: JSON.stringify({ source: "characters.startingFactions" }),
      },
    ]);
  });

  const db = seedDatabase();
  canonicaliseCharacters(db, {
    entityId: "character",
    schemaVersion: 1,
    rows: [
      {
        id: characterId,
        fields: {
          id: characterId,
          name: "Bandit",
          parentRef: missingParentRef(),
          raceRef: null,
          dropRefs: [{ kind: "lookupAsset", guid: "missing-item" }],
        },
      },
    ],
  });
  const diagnostics = emitCharacterReadModels(db, "/character-types");
  expect(diagnostics).toEqual([
    expect.objectContaining({
      code: "characterDropUnresolved",
      entityType: "character",
      entityId: characterId,
    }),
  ]);
  expect(db.query(`SELECT * FROM entity_edges`).all()).toEqual([]);
});

it("emits forward and inverse relationship sections", () => {
  const db = seedDatabase();
  canonicaliseCharacters(db, {
    entityId: "character",
    schemaVersion: 1,
    rows: [
      {
        id: characterId,
        fields: {
          id: characterId,
          name: "Bandit",
          parentRef: missingParentRef(),
          raceRef: null,
          dropRefs: [{ kind: "lookupAsset", guid: itemId }],
        },
      },
    ],
  });
  expect(emitCharacterReadModels(db, "/character-types")).toEqual([]);
  emitRelationshipSections(db);
  expect(
    db
      .query(
        `SELECT source_type, source_id, title, predicate FROM entity_relationship_sections ORDER BY source_type`,
      )
      .all(),
  ).toEqual([
    {
      source_type: "character",
      source_id: characterId,
      title: "Can drop",
      predicate: "can_drop",
    },
    {
      source_type: "item",
      source_id: itemId,
      title: "Dropped by",
      predicate: "can_drop",
    },
  ]);
});
