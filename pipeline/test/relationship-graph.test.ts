import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  ENTITY_GRAPH_DDL,
  auditEntityGraph,
  countPipelineDiagnostics,
  insertDisambiguationForDuplicateAliases,
  insertPipelineDiagnostics,
} from "$pipeline/relationships/relationship-graph";

describe("relationship graph", () => {
  it("audits missing public edge targets", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.run(
      "INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, is_public) VALUES (?, ?, ?, ?, ?, ?)",
      "item",
      "source",
      "Source",
      "/items/source",
      "source",
      1,
    );
    db.run(
      "INSERT INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "edge-1",
      "item",
      "source",
      "item",
      "missing",
      "variant_of",
      "Variant of",
      1,
      "{}",
      null,
    );

    expect(auditEntityGraph(db)).toContainEqual(
      expect.objectContaining({ code: "relationshipMissingTarget", severity: "fatal" }),
    );
  });

  it("turns duplicate aliases into disambiguation records instead of ambiguous aliases", () => {
    const options = insertDisambiguationForDuplicateAliases("iron", [
      { targetType: "item", targetId: "iron-sword", label: "Iron Sword" },
      { targetType: "item", targetId: "iron-ore", label: "Iron Ore" },
    ]);

    expect(options.termKey).toBe("iron");
    expect(JSON.parse(options.optionsJson)).toEqual([
      { targetType: "item", targetId: "iron-sword", label: "Iron Sword" },
      { targetType: "item", targetId: "iron-ore", label: "Iron Ore" },
    ]);
  });

  it("counts persisted pipeline diagnostics by source", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    insertPipelineDiagnostics(
      db,
      [
        { severity: "diagnostic", code: "rich", source: "rich-text", message: "rich" },
        {
          severity: "diagnostic",
          code: "relationship",
          source: "relationship-graph",
          message: "relationship",
        },
      ],
      "test",
    );

    expect(countPipelineDiagnostics(db, "rich-text")).toBe(1);
    expect(countPipelineDiagnostics(db, "relationship-graph")).toBe(1);
  });
});
