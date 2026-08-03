import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "$pipeline/relationships/relationship-graph";
import { emitRelationshipSections } from "$pipeline/relationships/relationship-sections";
import { relationshipRegistry } from "$pipeline/relationships/registry";

function seedGraph(): Database {
  const db = new Database(":memory:");
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(`
    INSERT INTO entity_nodes
      (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
    VALUES
      ('item', 'item-a', 'Item A', '/items/item-a', 'item-a', 'item-a', 1),
      ('status-effect', 'effect-a', 'Effect A', '/status-effects/effect-a', 'effect-a', 'effect-a', 1),
      ('item', 'item-private', 'Private item', '/items/item-private', 'item-private', 'item-private', 0),
      ('status-effect', 'effect-private', 'Private effect', '/status-effects/effect-private', 'effect-private', 'effect-private', 0)
  `);
  return db;
}

function addEdge(
  db: Database,
  edgeId: string,
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
  predicate: string,
): void {
  db.run(
    `INSERT INTO entity_edges
      (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [edgeId, sourceType, sourceId, targetType, targetId, predicate, "Edge label", 1, "{}", null],
  );
}

describe("relationship section projection", () => {
  it("writes forward and inverse sections when both titles are configured", () => {
    const db = seedGraph();
    addEdge(db, "both-edge", "item", "item-a", "status-effect", "effect-a", "both");

    emitRelationshipSections(db, {
      both: { forwardTitle: "Forward", inverseTitle: "Inverse", sortOrder: 1 },
    });

    expect(
      db
        .query(
          "SELECT source_type, source_id, title, predicate FROM entity_relationship_sections ORDER BY source_type",
        )
        .all(),
    ).toEqual([
      { source_type: "item", source_id: "item-a", title: "Forward", predicate: "both" },
      {
        source_type: "status-effect",
        source_id: "effect-a",
        title: "Inverse",
        predicate: "both",
      },
    ]);
  });

  it("writes only the inverse section for applies", () => {
    const db = seedGraph();
    addEdge(db, "applies-edge", "item", "item-a", "status-effect", "effect-a", "applies");

    emitRelationshipSections(db);

    expect(
      db.query("SELECT source_type, source_id, title FROM entity_relationship_sections").all(),
    ).toEqual([{ source_type: "status-effect", source_id: "effect-a", title: "Applied by items" }]);
  });

  it("omits edges whose source or target node is private", () => {
    const db = seedGraph();
    addEdge(db, "private-target", "item", "item-a", "status-effect", "effect-private", "applies");
    addEdge(db, "private-source", "item", "item-private", "status-effect", "effect-a", "applies");

    emitRelationshipSections(db);

    expect(db.query("SELECT COUNT(*) AS count FROM entity_relationship_sections").get()).toEqual({
      count: 0,
    });
  });

  it("fails with the predicate when an edge is not registered", () => {
    const db = seedGraph();
    addEdge(db, "unknown-edge", "item", "item-a", "status-effect", "effect-a", "not_registered");

    expect(() => emitRelationshipSections(db)).toThrow("not_registered");
  });

  it("keeps the variant_of section edge shape", () => {
    const db = seedGraph();
    db.run(
      `INSERT INTO entity_nodes
        (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["item-variant", "melee", "Melee weapon", "/objects/variant/melee", "melee", "melee", 1],
    );
    addEdge(db, "variant-edge", "item", "item-a", "item-variant", "melee", "variant_of");

    emitRelationshipSections(db);

    const row = db
      .query<{ section_id: string; title: string; edges_json: string }, []>(
        "SELECT section_id, title, edges_json FROM entity_relationship_sections",
      )
      .get();
    expect(row?.section_id).toBe("item-a:variant_of");
    expect(row?.title).toBe("Variant");
    expect(JSON.parse(row?.edges_json ?? "null")).toEqual([
      {
        targetType: "item-variant",
        targetId: "melee",
        targetLabel: "Melee weapon",
        targetShortId: "melee",
        targetRoutePath: "/objects/variant/melee",
        predicate: "variant_of",
        label: "Edge label",
        weight: 1,
        anchor: null,
      },
    ]);
  });

  it("distinguishes identical labels inside one section", () => {
    // 59 characters share the label "Unnamed character" and nine items are all called
    // Mysterious Fossil, so a section can list several links reading the same thing and
    // going somewhere different. Without this a reader cannot tell them apart and a screen
    // reader announces identical link names.
    const db = seedGraph();
    for (const id of ["char-a", "char-b"]) {
      db.run(
        `INSERT INTO entity_nodes
          (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["character", id, "Unnamed character", `/characters/${id}`, id, id, 1],
      );
      addEdge(db, `drop-${id}`, "character", id, "item", "item-a", "can_drop");
    }

    emitRelationshipSections(db);

    const row = db
      .query<{ edges_json: string }, []>(
        "SELECT edges_json FROM entity_relationship_sections WHERE source_type = 'item'",
      )
      .get();
    const labels = (JSON.parse(row?.edges_json ?? "[]") as { targetLabel: string }[]).map(
      (edge) => edge.targetLabel,
    );
    expect(labels).toEqual(["Unnamed character \u00b7 char-a", "Unnamed character \u00b7 char-b"]);
  });

  it("leaves a unique label untouched", () => {
    const db = seedGraph();
    db.run(
      `INSERT INTO entity_nodes
        (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["character", "char-a", "Jack", "/characters/char-a", "char-a", "char-a", 1],
    );
    addEdge(db, "drop-a", "character", "char-a", "item", "item-a", "can_drop");

    emitRelationshipSections(db);

    const row = db
      .query<{ edges_json: string }, []>(
        "SELECT edges_json FROM entity_relationship_sections WHERE source_type = 'item'",
      )
      .get();
    expect((JSON.parse(row?.edges_json ?? "[]") as { targetLabel: string }[])[0]?.targetLabel).toBe(
      "Jack",
    );
  });

  it("requires every registry entry to declare all fields", () => {
    expect(relationshipRegistry.variant_of).toEqual({
      forwardTitle: "Variant",
      inverseTitle: null,
      sortOrder: 10,
    });
  });
});
