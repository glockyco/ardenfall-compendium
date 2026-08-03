import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseCharacters } from "../src/entities/character/canonicaliser.ts";
import { emitCharacterReadModels } from "../src/entities/character/read-models.ts";
import { emitRelationshipSections } from "../src/relationships/relationship-sections.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { CHARACTER_DDL } from "../src/sql/character-ddl.ts";
import type { SnapshotEnvelope, SnapshotRef } from "../src/types.ts";

const itemId = "4ed20218.fixture-iron-sword";
const characterId = "named;character;character_bandit";

function seedDatabase(): Database {
  const db = new Database(":memory:");
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(CHARACTER_DDL);
  db.run(
    `INSERT INTO entity_nodes
        (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', ?, 'Iron Sword', '/items/iron-sword--4ed20218', 'iron-sword--4ed20218', '4ed20218', 1)`,
    [itemId],
  );
  return db;
}

function canonicalCharacterRows(envelope: SnapshotEnvelope) {
  const db = seedDatabase();
  canonicaliseCharacters(db, envelope);
  const rows = {
    characters: db.query(`SELECT id, character_name, drop_refs_json FROM characters`).all(),
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
            dropRefs: [{ kind: "lookupAsset", guid: itemId }],
          },
        },
      ],
    });

    expect(db.query(`SELECT id, character_name, drop_refs_json FROM characters`).get()).toEqual({
      id: characterId,
      character_name: "Bandit",
      drop_refs_json: JSON.stringify([{ kind: "lookupAsset", guid: itemId }]),
    });
    expect(emitCharacterReadModels(db)).toEqual([]);
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
          fields: { id: characterId, name: "Bandit", dropRefs, startingFactions },
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
         (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('faction', ?, 'Black Moth', '/factions/black-moth--a1000001', 'black-moth--a1000001', 'a1000001', 1)`,
      ["a1000001.fixture-black-moth"],
    );
    db.run(
      `INSERT INTO entity_nodes
         (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('faction', ?, 'Mages Guild', '/factions/mages-guild--a1000002', 'mages-guild--a1000002', 'a1000002', 1)`,
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
            dropRefs: [],
            startingFactions: [
              { kind: "lookupAsset", guid: "a1000001.fixture-black-moth" },
              { kind: "lookupAsset", guid: "a1000002.fixture-mages-guild" },
            ],
          },
        },
      ],
    });

    expect(emitCharacterReadModels(db)).toEqual([]);
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
          dropRefs: [{ kind: "lookupAsset", guid: "missing-item" }],
        },
      },
    ],
  });
  const diagnostics = emitCharacterReadModels(db);
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
          dropRefs: [{ kind: "lookupAsset", guid: itemId }],
        },
      },
    ],
  });
  expect(emitCharacterReadModels(db)).toEqual([]);
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
