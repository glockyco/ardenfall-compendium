import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseNpcs } from "../src/entities/npc/canonicaliser.ts";
import { emitNpcReadModels } from "../src/entities/npc/read-models.ts";
import { NPC_DDL } from "../src/sql/npc-ddl.ts";
import { CHARACTER_DDL } from "../src/sql/character-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { entityRegistry } from "../src/entities/registry.ts";
import type { NPCSnapshotFields, SnapshotEnvelope } from "../src/types.ts";

const townRef = { kind: "lookupAsset", guid: "town", unityType: "LocationAsset" } as const;
const caveRef = { kind: "lookupAsset", guid: "cave", unityType: "LocationAsset" } as const;
const characterNames = ["GraineryOwner", "Fisherman", "GrainThief", "UnnamedCharacter"] as const;

function missingParentRef(): string {
  return JSON.stringify({ kind: "missing", reason: "noParent", source: "test" });
}

function seedCharacterDefinitions(db: Database): void {
  for (const name of characterNames) {
    const id = `named;character;${name}`;
    db.run(
      `INSERT INTO characters (id, character_name, parent_ref_json, race_ref_json, drop_refs_json)
       VALUES (?, ?, ?, NULL, '[]')`,
      [id, name, missingParentRef()],
    );
    db.run(
      `INSERT INTO entity_nodes
         (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        "character",
        id,
        name,
        name,
        `/character-types/${name.toLowerCase()}`,
        name.toLowerCase(),
        name.toLowerCase(),
      ],
    );
  }
}

function envelope(): SnapshotEnvelope<NPCSnapshotFields> {
  return {
    entityId: "npc",
    schemaVersion: 1,
    rows: [
      {
        id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
        fields: {
          id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "characters",
            id: "00000000000000000000000000000001",
          },
          displayName: "Saya Sako",
          displayNameProvenance: "own",
          displayNameOwner: null,
          authoringLabel: "Grainery Owner",
          characterRef: { kind: "namedAsset", entity: "character", name: "GraineryOwner" },
          spawnPoint: { x: 1, y: 2, z: 3 },
          mapId: "ardenfall",
          containingLocationRefs: [townRef],
          dropRefs: [],
          dropRefsProvenance: "absent",
          dropRefsOwner: null,
          startingFactions: [],
          startingFactionsProvenance: "absent",
          startingFactionsOwner: null,
          startingLevel: null,
          startingLevelProvenance: "absent",
          startingLevelOwner: null,
          merchantRefs: [],
          merchantRefsProvenance: "absent",
          merchantRefsOwner: null,
          merchantGold: null,
          merchantGoldProvenance: "absent",
          merchantGoldOwner: null,
          merchantCategories: [],
          merchantCategoriesProvenance: "absent",
          merchantCategoriesOwner: null,
        },
      },
      {
        id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
        fields: {
          id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "characters",
            id: "00000000000000000000000000000002",
          },
          displayName: "Fishermen",
          displayNameProvenance: "inherited",
          displayNameOwner: "Fisherman",
          authoringLabel: "fishermen-label",
          characterRef: { kind: "namedAsset", entity: "character", name: "Fisherman" },
          spawnPoint: { x: 4, y: 5, z: 6 },
          mapId: "ardenfall",
          containingLocationRefs: [townRef, caveRef],
          dropRefs: [],
          dropRefsProvenance: "inherited",
          dropRefsOwner: "Fisherman",
          startingFactions: [],
          startingFactionsProvenance: "inherited",
          startingFactionsOwner: "Fisherman",
          startingLevel: null,
          startingLevelProvenance: "inherited",
          startingLevelOwner: "Fisherman",
          merchantRefs: [],
          merchantRefsProvenance: "absent",
          merchantRefsOwner: null,
          merchantGold: null,
          merchantGoldProvenance: "absent",
          merchantGoldOwner: null,
          merchantCategories: [],
          merchantCategoriesProvenance: "absent",
          merchantCategoriesOwner: null,
        },
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        fields: {
          id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "characters",
            id: "00000000000000000000000000000003",
          },
          displayName: "Grain Thief",
          displayNameProvenance: "own",
          displayNameOwner: null,
          authoringLabel: "grain-thief-label",
          characterRef: { kind: "namedAsset", entity: "character", name: "GrainThief" },
          spawnPoint: { x: 7, y: 8, z: 9 },
          mapId: "ardenfall",
          containingLocationRefs: [],
          dropRefs: [{ kind: "namedAsset", entity: "item", name: "ThiefLoot" }],
          dropRefsProvenance: "own",
          dropRefsOwner: null,
          startingFactions: [{ kind: "lookupAsset", guid: "thief-faction", unityType: "Faction" }],
          startingFactionsProvenance: "own",
          startingFactionsOwner: null,
          startingLevel: { automatic: false, addValue: 2, value: 4 },
          startingLevelProvenance: "own",
          startingLevelOwner: null,
          merchantRefs: [{ kind: "namedAsset", entity: "item", name: "ThiefStock" }],
          merchantRefsProvenance: "own",
          merchantRefsOwner: null,
          merchantGold: { kind: "namedAsset", entity: "leveledCount", name: "ThiefGold" },
          merchantGoldProvenance: "own",
          merchantGoldOwner: null,
          merchantCategories: [{ kind: "namedAsset", entity: "merchantCategory", name: "Weapons" }],
          merchantCategoriesProvenance: "own",
          merchantCategoriesOwner: null,
        },
      },
      {
        id: "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b",
        fields: {
          id: "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "characters",
            id: "00000000000000000000000000000004",
          },
          displayName: null,
          displayNameProvenance: "absent",
          displayNameOwner: null,
          authoringLabel: "unnamed-character-label",
          characterRef: { kind: "namedAsset", entity: "character", name: "UnnamedCharacter" },
          spawnPoint: { x: 10, y: 11, z: 12 },
          mapId: "ardenfall",
          containingLocationRefs: [],
          dropRefs: [],
          dropRefsProvenance: "absent",
          dropRefsOwner: null,
          startingFactions: [],
          startingFactionsProvenance: "absent",
          startingFactionsOwner: null,
          startingLevel: null,
          startingLevelProvenance: "absent",
          startingLevelOwner: null,
          merchantRefs: [],
          merchantRefsProvenance: "absent",
          merchantRefsOwner: null,
          merchantGold: null,
          merchantGoldProvenance: "absent",
          merchantGoldOwner: null,
          merchantCategories: [],
          merchantCategoriesProvenance: "absent",
          merchantCategoriesOwner: null,
        },
      },
    ],
  };
}

function setupCanonicalDb(source: SnapshotEnvelope<NPCSnapshotFields> = envelope()): Database {
  const db = new Database(":memory:");
  db.exec(CHARACTER_DDL);
  db.exec(`${NPC_DDL}
    CREATE TABLE placements (
      entity_id TEXT NOT NULL, instance_id TEXT NOT NULL, map_id TEXT,
      map_x REAL NOT NULL, map_y REAL NOT NULL, elevation REAL NOT NULL,
      source_ref_json TEXT NOT NULL, PRIMARY KEY (entity_id, instance_id)
    );`);
  // The canonicaliser reads fields by name, so its input models them as unknown. The
  // fixture states them, and this is the one place the two views meet.
  canonicaliseNpcs(db, source as unknown as SnapshotEnvelope);
  return db;
}

function canonicalNpcRows(source: SnapshotEnvelope<NPCSnapshotFields>) {
  const db = setupCanonicalDb(source);
  const rows = {
    npcs: db.query(`SELECT * FROM npcs`).all(),
    placements: db.query(`SELECT * FROM placements`).all(),
    locations: db.query(`SELECT * FROM npc_location_refs`).all(),
  };
  db.close();
  return rows;
}

describe("NPC pipeline", () => {
  it("canonicalises location references independent of arrival order", () => {
    const source = envelope();
    const reversed: SnapshotEnvelope<NPCSnapshotFields> = {
      ...source,
      rows: [...source.rows].reverse().map((row) => ({
        ...row,
        fields: {
          ...row.fields,
          containingLocationRefs: [...row.fields.containingLocationRefs].reverse(),
        },
      })),
    };

    expect(canonicalNpcRows(reversed)).toEqual(canonicalNpcRows(source));
  });

  it("canonicalises rows and expands all containing locations", () => {
    const db = setupCanonicalDb();
    expect(
      db
        .query<
          {
            id: string;
            display_name: string | null;
            authoring_label: string | null;
            character_ref_json: string | null;
            drop_refs_json: string;
            starting_level_json: string | null;
            merchant_refs_json: string;
            merchant_gold_json: string | null;
            merchant_categories_json: string;
          },
          []
        >(
          `SELECT id, display_name, authoring_label, character_ref_json,
                  drop_refs_json, starting_level_json, merchant_refs_json,
                  merchant_gold_json, merchant_categories_json
           FROM npcs ORDER BY id`,
        )
        .all(),
    ).toEqual([
      {
        id: "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b",
        display_name: null,
        authoring_label: "unnamed-character-label",
        character_ref_json: '{"kind":"namedAsset","entity":"character","name":"UnnamedCharacter"}',
        drop_refs_json: "[]",
        starting_level_json: null,
        merchant_refs_json: "[]",
        merchant_gold_json: null,
        merchant_categories_json: "[]",
      },
      {
        id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
        display_name: "Saya Sako",
        authoring_label: "Grainery Owner",
        character_ref_json: '{"kind":"namedAsset","entity":"character","name":"GraineryOwner"}',
        drop_refs_json: "[]",
        starting_level_json: null,
        merchant_refs_json: "[]",
        merchant_gold_json: null,
        merchant_categories_json: "[]",
      },
      {
        id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
        display_name: "Fishermen",
        authoring_label: "fishermen-label",
        character_ref_json: '{"kind":"namedAsset","entity":"character","name":"Fisherman"}',
        drop_refs_json: "[]",
        starting_level_json: null,
        merchant_refs_json: "[]",
        merchant_gold_json: null,
        merchant_categories_json: "[]",
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        display_name: "Grain Thief",
        authoring_label: "grain-thief-label",
        character_ref_json: '{"kind":"namedAsset","entity":"character","name":"GrainThief"}',
        drop_refs_json: '[{"kind":"namedAsset","entity":"item","name":"ThiefLoot"}]',
        starting_level_json: '{"automatic":false,"addValue":2,"value":4}',
        merchant_refs_json: '[{"kind":"namedAsset","entity":"item","name":"ThiefStock"}]',
        merchant_gold_json: '{"kind":"namedAsset","entity":"leveledCount","name":"ThiefGold"}',
        merchant_categories_json:
          '[{"kind":"namedAsset","entity":"merchantCategory","name":"Weapons"}]',
      },
    ]);
    expect(db.query("SELECT COUNT(*) AS count FROM npcs").get()).toEqual({ count: 4 });
    expect(
      (db.query("PRAGMA table_info('npcs')").all() as { name: string }[]).map(
        (column) => column.name,
      ),
    ).not.toContain("display_name_provenance");
    expect(
      (db.query("PRAGMA table_info('npcs')").all() as { name: string }[]).map(
        (column) => column.name,
      ),
    ).not.toContain("display_name_owner");
    expect(db.query("SELECT COUNT(*) AS count FROM npc_location_refs").get()).toEqual({ count: 3 });
    expect(db.query("SELECT COUNT(*) AS count FROM npc_faction_refs").get()).toEqual({ count: 1 });
    expect(
      db
        .query(
          "SELECT id, npc_id, field_name, provenance, owner FROM npc_value_provenance WHERE npc_id = ? ORDER BY field_name",
        )
        .all("instances;characters;c7e08b41d9a24f37b15ce6208af391dc"),
    ).toEqual([
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:displayName",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "displayName",
        provenance: "own",
        owner: null,
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:dropRefs",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "dropRefs",
        provenance: "own",
        owner: null,
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:merchantCategories",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "merchantCategories",
        provenance: "own",
        owner: null,
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:merchantGold",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "merchantGold",
        provenance: "own",
        owner: null,
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:merchantRefs",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "merchantRefs",
        provenance: "own",
        owner: null,
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:startingFactions",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "startingFactions",
        provenance: "own",
        owner: null,
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:provenance:startingLevel",
        npc_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        field_name: "startingLevel",
        provenance: "own",
        owner: null,
      },
    ]);
    expect(
      db.query("SELECT id, target_faction_id FROM npc_faction_refs ORDER BY id").all(),
    ).toEqual([
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:starting-faction:0",
        target_faction_id: "thief-faction",
      },
    ]);
    expect(db.query("SELECT id FROM npc_location_refs ORDER BY id").all()).toEqual([
      { id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284:location:0" },
      { id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55:location:0" },
      { id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55:location:1" },
    ]);
    db.close();
  });

  it("emits page nodes, presentation rows, map points, and one edge per NPC-location pair", () => {
    const db = setupCanonicalDb();
    db.exec(`${ENTITY_GRAPH_DDL}
      CREATE TABLE locations (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO locations VALUES ('town', 'Town'), ('cave', 'Cave');
      INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
        ('location', 'town', 'Town', 'Town', '/locations/town', 'town', 'town', 1),
        ('location', 'cave', 'Cave', 'Cave', '/locations/cave', 'cave', 'cave', 1);
    `);
    seedCharacterDefinitions(db);
    const diagnostics = emitNpcReadModels(db);
    expect(diagnostics).toEqual([]);
    const node = db
      .query<
        { has_page: number; label: string | null; route_path: string; short_id: string },
        [string, string]
      >(
        "SELECT has_page, label, route_path, short_id FROM entity_nodes WHERE entity_type = ? AND entity_id = ?",
      )
      .get("npc", "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284");
    expect(node).toEqual({
      has_page: 1,
      label: "Saya Sako",
      route_path: "/placed-characters/saya-sako--4b1c9e07",
      short_id: "4b1c9e07",
    });
    expect(node?.label).not.toBe("Grainery Owner");
    const namelessNode = db
      .query<{ has_page: number; label: string | null; route_path: string }, [string, string]>(
        "SELECT has_page, label, route_path FROM entity_nodes WHERE entity_type = ? AND entity_id = ?",
      )
      .get("npc", "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b");
    expect(namelessNode).toEqual({
      has_page: 1,
      label: "Unnamed character",
      route_path: "/placed-characters/unnamed-character--2d6f47b3",
    });
    expect(
      db.query("SELECT COUNT(*) AS count FROM entity_nodes WHERE entity_type = 'npc'").get(),
    ).toEqual({
      count: 4,
    });
    expect(db.query("SELECT COUNT(*) AS count FROM npc_presentation_rows").get()).toEqual({
      count: 4,
    });
    expect(
      db
        .query(
          "SELECT COUNT(*) AS count FROM entity_nodes WHERE entity_type = 'npc' AND has_page = 1",
        )
        .get(),
    ).toEqual({ count: 4 });
    expect(
      db
        .query<
          {
            id: string;
            name: string;
            display_name_provenance: string;
            display_name_owner: string | null;
            render_context: string;
            map_id: string | null;
            map_x: number;
            map_y: number;
            elevation: number;
            location_ids_json: string;
          },
          [string]
        >(
          `SELECT id, name, display_name_provenance, display_name_owner,
                  render_context, map_id, map_x, map_y, elevation, location_ids_json
           FROM npc_presentation_rows WHERE id = ?`,
        )
        .get("instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284"),
    ).toEqual({
      id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
      name: "Saya Sako",
      display_name_provenance: "own",
      display_name_owner: null,
      render_context: "placed-character-presentation-v1",
      map_id: "ardenfall",
      map_x: 1,
      map_y: 3,
      elevation: 2,
      location_ids_json: '["town"]',
    });
    expect(
      db
        .query<
          {
            id: string;
            name: string;
            display_name_provenance: string;
            display_name_owner: string | null;
          },
          []
        >(
          `SELECT id, name, display_name_provenance, display_name_owner
           FROM npc_presentation_rows ORDER BY id`,
        )
        .all(),
    ).toEqual([
      {
        id: "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b",
        name: "Unnamed character",
        display_name_provenance: "absent",
        display_name_owner: null,
      },
      {
        id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
        name: "Saya Sako",
        display_name_provenance: "own",
        display_name_owner: null,
      },
      {
        id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
        name: "Fishermen",
        display_name_provenance: "inherited",
        display_name_owner: "Fisherman",
      },
      {
        id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        name: "Grain Thief",
        display_name_provenance: "own",
        display_name_owner: null,
      },
    ]);
    expect(node?.route_path).toBe("/placed-characters/saya-sako--4b1c9e07");
    db.exec(`CREATE TABLE map_points (
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
      name TEXT, map_id TEXT, map_x REAL NOT NULL, map_y REAL NOT NULL,
      elevation REAL NOT NULL, enabled INTEGER NOT NULL,
      show_on_map_debug_only INTEGER NOT NULL, allow_fast_travel INTEGER NOT NULL
    );`);
    const npcModule = entityRegistry.npc;
    if (!npcModule?.mapProjection) throw new Error("npc registry entry has no map projection");
    db.exec(npcModule.mapProjection.points);
    expect(
      db.query("SELECT COUNT(*) AS count FROM map_points WHERE entity_id = 'npc'").get(),
    ).toEqual({ count: 4 });
    expect(
      db
        .query(
          "SELECT source_type, source_id, target_type, target_id, edge_id FROM entity_edges WHERE predicate = 'found_at' ORDER BY edge_id",
        )
        .all(),
    ).toEqual([
      {
        source_type: "npc",
        source_id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
        target_type: "location",
        target_id: "town",
        edge_id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284:found_at:location:town",
      },
      {
        source_type: "npc",
        source_id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
        target_type: "location",
        target_id: "cave",
        edge_id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55:found_at:location:cave",
      },
      {
        source_type: "npc",
        source_id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
        target_type: "location",
        target_id: "town",
        edge_id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55:found_at:location:town",
      },
    ]);
    expect(
      db
        .query(
          `SELECT source_id, target_id, predicate, edge_id
           FROM entity_edges
           WHERE predicate = 'instance_of'
           ORDER BY source_id`,
        )
        .all(),
    ).toEqual([
      {
        source_id: "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b",
        target_id: "named;character;UnnamedCharacter",
        predicate: "instance_of",
        edge_id:
          "instances;characters;2d6f47b30c8e41a59fbd73e15c0a869b:instance_of:character:named;character;UnnamedCharacter",
      },
      {
        source_id: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
        target_id: "named;character;GraineryOwner",
        predicate: "instance_of",
        edge_id:
          "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284:instance_of:character:named;character;GraineryOwner",
      },
      {
        source_id: "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55",
        target_id: "named;character;Fisherman",
        predicate: "instance_of",
        edge_id:
          "instances;characters;9f3a2c58e71d4b6a83cf10924eab7d55:instance_of:character:named;character;Fisherman",
      },
      {
        source_id: "instances;characters;c7e08b41d9a24f37b15ce6208af391dc",
        target_id: "named;character;GrainThief",
        predicate: "instance_of",
        edge_id:
          "instances;characters;c7e08b41d9a24f37b15ce6208af391dc:instance_of:character:named;character;GrainThief",
      },
    ]);
    const evidence = db
      .query<{ evidence_json: string }, []>(
        "SELECT evidence_json FROM entity_edges WHERE predicate = 'found_at'",
      )
      .all()
      .map((row) => JSON.parse(row.evidence_json) as Record<string, unknown>);
    // Every derived edge must say where it came from, so assert the shape on all of them rather
    // than on whichever one the row order happens to put first.
    for (const entry of evidence) {
      expect(entry).toMatchObject({
        containmentTest: "LocationAsset.IsInside",
        containmentSource: "game's own test",
      });
      expect(entry.npcRecordId).toMatch(/^instances;characters;[0-9a-f]{32}$/);
    }
    db.close();
  });

  it("reports an unresolved character reference for its placement", () => {
    const source = envelope();
    const unresolvedSource: SnapshotEnvelope<NPCSnapshotFields> = {
      ...source,
      rows: source.rows.map((row, index) =>
        index === 0
          ? {
              ...row,
              fields: {
                ...row.fields,
                characterRef: {
                  kind: "namedAsset",
                  entity: "character",
                  name: "MissingCharacter",
                },
              },
            }
          : row,
      ),
    };
    const db = setupCanonicalDb(unresolvedSource);
    db.exec(`${ENTITY_GRAPH_DDL}
      CREATE TABLE locations (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO locations VALUES ('town', 'Town'), ('cave', 'Cave');
      INSERT INTO entity_nodes (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page) VALUES
        ('location', 'town', 'Town', 'Town', '/locations/town', 'town', 'town', 1),
        ('location', 'cave', 'Cave', 'Cave', '/locations/cave', 'cave', 'cave', 1);
    `);
    seedCharacterDefinitions(db);

    expect(emitNpcReadModels(db)).toEqual([
      {
        severity: "diagnostic",
        source: "relationship-graph",
        code: "npcCharacterReferenceUnresolved",
        message:
          "NPC 'instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284' has an unresolvable character reference.",
        entityType: "npc",
        entityId: "instances;characters;4b1c9e07a2d3418fb6ce5710dd93a284",
        field: "npcs.character_ref_json",
        evidence: {
          characterRefJson: '{"kind":"namedAsset","entity":"character","name":"MissingCharacter"}',
        },
      },
    ]);
    expect(
      db.query("SELECT COUNT(*) AS count FROM entity_edges WHERE predicate = 'instance_of'").get(),
    ).toEqual({ count: 3 });
    db.close();
  });
});
