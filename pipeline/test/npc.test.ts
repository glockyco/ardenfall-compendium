import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseNpcs } from "../src/entities/npc/canonicaliser.ts";
import { emitNpcReadModels } from "../src/entities/npc/read-models.ts";
import { NPC_DDL } from "../src/sql/npc-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { entityRegistry } from "../src/entities/registry.ts";
import type { NPCSnapshotFields, SnapshotEnvelope } from "../src/types.ts";

const townRef = { kind: "lookupAsset", guid: "town", unityType: "LocationAsset" } as const;
const caveRef = { kind: "lookupAsset", guid: "cave", unityType: "LocationAsset" } as const;

function envelope(): SnapshotEnvelope<NPCSnapshotFields> {
  return {
    entityId: "npc",
    schemaVersion: 1,
    rows: [
      {
        id: "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284",
        fields: {
          id: "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "npcs",
            id: "00000000000000000000000000000001",
          },
          friendlyName: "Grainery Owner",
          spawnPoint: { x: 1, y: 2, z: 3 },
          mapId: "ardenfall",
          containingLocationRefs: [townRef],
        },
      },
      {
        id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55",
        fields: {
          id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "npcs",
            id: "00000000000000000000000000000002",
          },
          friendlyName: "Fishermen",
          spawnPoint: { x: 4, y: 5, z: 6 },
          mapId: "ardenfall",
          containingLocationRefs: [townRef, caveRef],
        },
      },
      {
        id: "instances;npcs;c7e08b41d9a24f37b15ce6208af391dc",
        fields: {
          id: "instances;npcs;c7e08b41d9a24f37b15ce6208af391dc",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "npcs",
            id: "00000000000000000000000000000003",
          },
          friendlyName: "Grain Thief",
          spawnPoint: { x: 7, y: 8, z: 9 },
          mapId: "ardenfall",
          containingLocationRefs: [],
        },
      },
      {
        id: "instances;npcs;2d6f47b30c8e41a59fbd73e15c0a869b",
        fields: {
          id: "instances;npcs;2d6f47b30c8e41a59fbd73e15c0a869b",
          recordRef: {
            kind: "record",
            table: "world",
            subtable: "npcs",
            id: "00000000000000000000000000000004",
          },
          friendlyName: null,
          spawnPoint: { x: 10, y: 11, z: 12 },
          mapId: "ardenfall",
          containingLocationRefs: [],
        },
      },
    ],
  };
}

function setupCanonicalDb(source: SnapshotEnvelope<NPCSnapshotFields> = envelope()): Database {
  const db = new Database(":memory:");
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
    expect(db.query("SELECT COUNT(*) AS count FROM npcs").get()).toEqual({ count: 4 });
    expect(db.query("SELECT COUNT(*) AS count FROM npc_location_refs").get()).toEqual({ count: 3 });
    expect(db.query("SELECT id FROM npc_location_refs ORDER BY id").all()).toEqual([
      { id: "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284:location:0" },
      { id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55:location:0" },
      { id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55:location:1" },
    ]);
    db.close();
  });

  it("emits page nodes, presentation rows, map points, and one edge per NPC-location pair", () => {
    const db = setupCanonicalDb();
    db.exec(`${ENTITY_GRAPH_DDL}
      CREATE TABLE locations (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO locations VALUES ('town', 'Town'), ('cave', 'Cave');
      INSERT INTO entity_nodes VALUES
        ('location', 'town', 'Town', '/locations/town', 'town', 'town', 1),
        ('location', 'cave', 'Cave', '/locations/cave', 'cave', 'cave', 1);
    `);
    const diagnostics = emitNpcReadModels(db);
    expect(diagnostics).toEqual([]);
    const node = db
      .query<
        { has_page: number; label: string | null; route_path: string; short_id: string },
        [string, string]
      >(
        "SELECT has_page, label, route_path, short_id FROM entity_nodes WHERE entity_type = ? AND entity_id = ?",
      )
      .get("npc", "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284");
    expect(node).toEqual({
      has_page: 1,
      label: "Grainery Owner",
      route_path: "/placed-characters/grainery-owner--4b1c9e07",
      short_id: "4b1c9e07",
    });
    const namelessNode = db
      .query<{ has_page: number; label: string | null; route_path: string }, [string, string]>(
        "SELECT has_page, label, route_path FROM entity_nodes WHERE entity_type = ? AND entity_id = ?",
      )
      .get("npc", "instances;npcs;2d6f47b30c8e41a59fbd73e15c0a869b");
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
            render_context: string;
            map_id: string | null;
            map_x: number;
            map_y: number;
            elevation: number;
            location_ids_json: string;
            map_query: string;
          },
          [string]
        >(
          `SELECT id, name, render_context, map_id, map_x, map_y, elevation,
                  location_ids_json, map_query
           FROM npc_presentation_rows WHERE id = ?`,
        )
        .get("instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284"),
    ).toEqual({
      id: "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284",
      name: "Grainery Owner",
      render_context: "placed-character-presentation-v1",
      map_id: "ardenfall",
      map_x: 1,
      map_y: -3,
      elevation: 2,
      location_ids_json: '["town"]',
      map_query: "map=ardenfall&sel=4b1c9e07",
    });
    expect(node?.route_path).toBe("/placed-characters/grainery-owner--4b1c9e07");
    db.exec(`CREATE TABLE map_points (
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, instance_id TEXT NOT NULL,
      name TEXT, map_id TEXT, map_x REAL NOT NULL, map_y REAL NOT NULL,
      elevation REAL NOT NULL, show_on_map_debug_only INTEGER NOT NULL,
      allow_fast_travel INTEGER NOT NULL
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
        source_id: "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284",
        target_type: "location",
        target_id: "town",
        edge_id: "instances;npcs;4b1c9e07a2d3418fb6ce5710dd93a284:found_at:location:town",
      },
      {
        source_type: "npc",
        source_id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55",
        target_type: "location",
        target_id: "cave",
        edge_id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55:found_at:location:cave",
      },
      {
        source_type: "npc",
        source_id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55",
        target_type: "location",
        target_id: "town",
        edge_id: "instances;npcs;9f3a2c58e71d4b6a83cf10924eab7d55:found_at:location:town",
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
      expect(entry.npcRecordId).toMatch(/^instances;npcs;[0-9a-f]{32}$/);
    }
    db.close();
  });
});
