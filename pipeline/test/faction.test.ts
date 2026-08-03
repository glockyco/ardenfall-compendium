import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicaliseFactions } from "../src/entities/faction/canonicaliser.ts";
import { emitFactionReadModels } from "../src/entities/faction/read-models.ts";
import { relationshipRegistry } from "../src/relationships/registry.ts";
import { FACTION_DDL } from "../src/sql/faction-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import type { FactionSnapshotFields, SnapshotEnvelope } from "../src/types.ts";

const blackMoth = "a1000001.fixture-black-moth";
const magesGuild = "a1000002.fixture-mages-guild";

function envelope(): SnapshotEnvelope<FactionSnapshotFields & Record<string, unknown>> {
  return {
    entityId: "faction",
    schemaVersion: 1,
    rows: [
      {
        id: blackMoth,
        fields: {
          id: blackMoth,
          name: "Black Moth",
          factionId: "blackmoth",
          description: "A hidden faction.",
          iconRef: null,
          alliable: true,
          enableReputation: true,
          alwaysShowInUI: true,
          canBeDisguised: false,
          enableBounty: true,
          interFactionRelationships: [
            {
              faction: { kind: "lookupAsset", guid: magesGuild },
              relationship: -100,
              isEnemy: true,
            },
          ],
        },
      },
      {
        id: magesGuild,
        fields: {
          id: magesGuild,
          name: null,
          factionId: "magesguild",
          description: "",
          iconRef: null,
          alliable: false,
          enableReputation: false,
          alwaysShowInUI: false,
          canBeDisguised: true,
          enableBounty: false,
          interFactionRelationships: [
            {
              faction: { kind: "lookupAsset", guid: blackMoth },
              relationship: -600,
              isEnemy: false,
            },
          ],
        },
      },
    ],
  };
}

function database(): Database {
  const db = new Database(":memory:");
  db.exec(FACTION_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  return db;
}

describe("faction pipeline", () => {
  it("canonicalises root fields and expands both relationship shapes", () => {
    const db = database();
    canonicaliseFactions(db, envelope());

    expect(
      db.query("SELECT id, name, faction_id, enable_bounty FROM factions ORDER BY id").all(),
    ).toEqual([
      { id: blackMoth, name: "Black Moth", faction_id: "blackmoth", enable_bounty: 1 },
      { id: magesGuild, name: null, faction_id: "magesguild", enable_bounty: 0 },
    ]);
    expect(
      db
        .query(
          "SELECT id, source_faction_id, target_faction_id, relationship, is_enemy FROM faction_relationships ORDER BY id",
        )
        .all(),
    ).toEqual([
      {
        id: `${blackMoth}:relationship:0`,
        source_faction_id: blackMoth,
        target_faction_id: magesGuild,
        relationship: -100,
        is_enemy: 1,
      },
      {
        id: `${magesGuild}:relationship:0`,
        source_faction_id: magesGuild,
        target_faction_id: blackMoth,
        relationship: -600,
        is_enemy: 0,
      },
    ]);
  });

  it("emits faction nodes, routes, and both relationship predicates", () => {
    const db = database();
    canonicaliseFactions(db, envelope());
    expect(emitFactionReadModels(db)).toEqual([]);

    const nodes = db
      .query(
        "SELECT entity_id, label, route_path FROM entity_nodes WHERE entity_type = 'faction' ORDER BY entity_id",
      )
      .all() as { entity_id: string; label: string; route_path: string }[];
    expect(nodes).toEqual([
      expect.objectContaining({
        entity_id: blackMoth,
        label: "Black Moth",
        route_path: expect.stringMatching(/^\/factions\/black-moth/),
      }),
      expect.objectContaining({
        entity_id: magesGuild,
        label: "Unnamed faction",
        route_path: expect.stringMatching(/^\/factions\/unnamed-faction/),
      }),
    ]);
    expect(db.query(`SELECT name FROM faction_overview_rows WHERE id = ?`).get(magesGuild)).toEqual(
      { name: "Unnamed faction" },
    );
    expect(
      db.query(`SELECT name FROM faction_presentation_rows WHERE id = ?`).get(magesGuild),
    ).toEqual({ name: "Unnamed faction" });
    expect(db.query("SELECT predicate, label FROM entity_edges ORDER BY edge_id").all()).toEqual([
      { predicate: "starts_opposed_to", label: "Enemy" },
      { predicate: "starts_opposed_to", label: "Standing -600" },
    ]);
  });

  it("treats a whitespace-only faction name as unnamed", () => {
    const db = database();
    db.run(
      `INSERT INTO factions (
         id, name, faction_id, description, icon_ref_json, alliable, enable_reputation,
         always_show_in_ui, can_be_disguised, enable_bounty
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["b1a0c4d2.11400000", " \t ", "blank", "", null, 0, 0, 0, 0, 0],
    );

    expect(emitFactionReadModels(db)).toEqual([]);
    expect(db.query(`SELECT name FROM faction_overview_rows`).get()).toEqual({
      name: "Unnamed faction",
    });
    expect(db.query(`SELECT name FROM faction_presentation_rows`).get()).toEqual({
      name: "Unnamed faction",
    });
  });

  it("declares both faction predicates", () => {
    expect(relationshipRegistry.starts_in_faction).toEqual({
      forwardTitle: "Factions",
      inverseTitle: "Starting members",
      sortOrder: 70,
    });
    expect(relationshipRegistry.starts_opposed_to).toEqual({
      forwardTitle: "Opposed at the start",
      inverseTitle: "Opposed by at the start",
      sortOrder: 80,
    });
  });

  it("fails on a positive non-enemy relationship", () => {
    const db = database();
    const data = envelope();
    data.rows[0]!.fields.interFactionRelationships[0]!.relationship = 1;
    data.rows[0]!.fields.interFactionRelationships[0]!.isEnemy = false;

    expect(() => canonicaliseFactions(db, data)).toThrow(
      `faction '${blackMoth}' has a positive relationship of 1 with faction '${magesGuild}' while isEnemy is false`,
    );
  });
});
