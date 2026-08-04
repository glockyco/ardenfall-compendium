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
      (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
    VALUES
      ('item', 'item-a', 'Item A', 'Item A', '/items/item-a', 'item-a', 'item-a', 1),
      ('status-effect', 'effect-a', 'Effect A', 'Effect A', '/status-effects/effect-a', 'effect-a', 'effect-a', 1),
      ('item', 'item-private', 'Private item', 'Private item', '/items/item-private', 'item-private', 'item-private', 0),
      ('spell', 'spell-a', 'Spell A', 'Spell A', '/spells/spell-a', 'spell-a', 'spell-a', 1),
      ('status-effect', 'effect-private', 'Private effect', 'Private effect', NULL, 'effect-private', 'effect-private', 0)
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

  it("writes only the inverse item section for applies", () => {
    const db = seedGraph();
    addEdge(db, "applies-edge", "item", "item-a", "status-effect", "effect-a", "applies");

    emitRelationshipSections(db);

    expect(
      db.query("SELECT source_type, source_id, title FROM entity_relationship_sections").all(),
    ).toEqual([
      {
        source_type: "status-effect",
        source_id: "effect-a",
        title: "Applied by items",
      },
    ]);
  });

  it("writes an inverse spell section for applies", () => {
    const db = seedGraph();
    addEdge(db, "applies-edge", "spell", "spell-a", "status-effect", "effect-a", "applies");

    emitRelationshipSections(db);

    expect(
      db.query("SELECT source_type, source_id, title FROM entity_relationship_sections").all(),
    ).toEqual([
      {
        source_type: "status-effect",
        source_id: "effect-a",
        title: "Applied by spells",
      },
    ]);
  });

  it("separates mixed applies inverse edges by source type", () => {
    const db = seedGraph();
    addEdge(db, "applies-item", "item", "item-a", "status-effect", "effect-a", "applies");
    addEdge(db, "applies-spell", "spell", "spell-a", "status-effect", "effect-a", "applies");

    emitRelationshipSections(db);

    expect(
      db
        .query<{ title: string; edges_json: string }, []>(
          "SELECT title, edges_json FROM entity_relationship_sections ORDER BY title",
        )
        .all()
        .map((row) => ({
          title: row.title,
          labels: (JSON.parse(row.edges_json) as { targetLabel: string }[]).map(
            (edge) => edge.targetLabel,
          ),
        })),
    ).toEqual([
      { title: "Applied by items", labels: ["Item A"] },
      { title: "Applied by spells", labels: ["Spell A"] },
    ]);
  });

  it("skips missing nodes and includes page-less targets as plain-text edges", () => {
    const db = seedGraph();
    addEdge(db, "page-less-target", "item", "item-a", "status-effect", "effect-private", "both");
    addEdge(db, "missing-target", "item", "item-a", "status-effect", "effect-missing", "both");
    addEdge(db, "missing-source", "item", "item-missing", "status-effect", "effect-a", "both");
    const diagnostics = emitRelationshipSections(db, {
      both: { forwardTitle: "Forward", inverseTitle: "Inverse", sortOrder: 1 },
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "diagnostic",
        code: "relationshipEdgeNodeMissing",
        message:
          "Relationship edge 'missing-target' with predicate 'both' is missing target node 'status-effect:effect-missing'.",
        field: "entity_edges.target_id",
      }),
      expect.objectContaining({
        severity: "diagnostic",
        code: "relationshipEdgeNodeMissing",
        message:
          "Relationship edge 'missing-source' with predicate 'both' is missing source node 'item:item-missing'.",
        field: "entity_edges.source_id",
      }),
    ]);

    expect(
      db
        .query<{ source_type: string; source_id: string; title: string }, []>(
          "SELECT source_type, source_id, title FROM entity_relationship_sections",
        )
        .all(),
    ).toEqual([{ source_type: "item", source_id: "item-a", title: "Forward" }]);
    expect(
      JSON.parse(
        db
          .query<{ edges_json: string }, []>(
            "SELECT edges_json FROM entity_relationship_sections WHERE source_id = 'item-a'",
          )
          .get()?.edges_json ?? "null",
      ),
    ).toEqual([
      {
        targetType: "status-effect",
        targetId: "effect-private",
        targetLabel: "Private effect",
        targetShortId: "effect-private",
        targetRoutePath: null,
        targetHasPage: false,
        predicate: "both",
        label: "Edge label",
        weight: 1,
        anchor: null,
      },
    ]);
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
        (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "item-variant",
        "melee",
        "Melee weapon",
        "Melee weapon",
        "/objects/variant/melee",
        "melee",
        "melee",
        1,
      ],
    );
    addEdge(db, "variant-edge", "item", "item-a", "item-variant", "melee", "variant_of");

    emitRelationshipSections(db);

    const row = db
      .query<{ section_id: string; title: string; edges_json: string }, []>(
        "SELECT section_id, title, edges_json FROM entity_relationship_sections",
      )
      .get();
    expect(row?.section_id).toBe("item-a:variant_of:forward:item");
    expect(row?.title).toBe("Variant");
    expect(JSON.parse(row?.edges_json ?? "null")).toEqual([
      {
        targetType: "item-variant",
        targetId: "melee",
        targetLabel: "Melee weapon",
        targetShortId: "melee",
        targetRoutePath: "/objects/variant/melee",
        targetHasPage: true,
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
          (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "character",
          id,
          "Unnamed character",
          `Unnamed character · ${id}`,
          `/characters/${id}`,
          id,
          id,
          1,
        ],
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
    expect(labels).toEqual(["Unnamed character · char-a", "Unnamed character · char-b"]);
  });

  it("leaves a unique label untouched", () => {
    const db = seedGraph();
    db.run(
      `INSERT INTO entity_nodes
        (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["character", "char-a", "Jack", "Jack", "/characters/char-a", "char-a", "char-a", 1],
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

  it("keeps rendered and graph-only registry shapes declarative", () => {
    expect(relationshipRegistry.variant_of).toEqual({
      forwardTitle: "Variant",
      inverseTitle: null,
      sortOrder: 10,
    });
    expect(relationshipRegistry.applies).toEqual({
      forwardTitle: null,
      inverseTitle: {
        item: "Applied by items",
        spell: "Applied by spells",
      },
      sortOrder: 40,
    });
    expect(relationshipRegistry.speaks_about_quest).toEqual({
      forwardTitle: null,
      inverseTitle: null,
    });
  });
});
