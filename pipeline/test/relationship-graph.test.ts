import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL, auditEntityGraph } from "$pipeline/relationships/relationship-graph";

describe("relationship graph", () => {
  it("audits missing page edge targets", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.run(
      "INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["item", "source", "Source", "/items/source--abc12345", "source--abc12345", "abc12345", 1],
    );
    db.run(
      "INSERT INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["edge-1", "item", "source", "item", "missing", "variant_of", "Variant of", 1, "{}", null],
    );

    expect(auditEntityGraph(db)).toContainEqual(
      expect.objectContaining({ code: "relationshipMissingTarget", severity: "fatal" }),
    );
  });

  it("enforces (entity_type, canonical_slug) uniqueness on entity_nodes", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.run(
      `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', 'a', 'A', '/items/a--abc12345', 'a--abc12345', 'abc12345', 1)`,
    );
    expect(() =>
      db.run(
        `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
         VALUES ('item', 'b', 'B', '/items/a--abc12345', 'a--abc12345', 'def67890', 1)`,
      ),
    ).toThrow(/UNIQUE/);
  });

  it("enforces (entity_type, short_id) uniqueness on entity_nodes", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.run(
      `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', 'a', 'A', '/items/foo--abc12345', 'foo--abc12345', 'abc12345', 1)`,
    );
    expect(() =>
      db.run(
        `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
         VALUES ('item', 'b', 'B', '/items/bar--abc12345', 'bar--abc12345', 'abc12345', 1)`,
      ),
    ).toThrow(/UNIQUE/);
  });

  it("emits a fatal slugCollision diagnostic when two nodes share a (entity_type, short_id)", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.exec("DROP INDEX idx_entity_nodes_short_id;");
    db.run(
      `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', 'a', 'A', '/items/a--abc12345', 'a--abc12345', 'abc12345', 1)`,
    );
    db.run(
      `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, has_page)
       VALUES ('item', 'b', 'B', '/items/b--abc12345', 'b--abc12345', 'abc12345', 1)`,
    );

    const diagnostics = auditEntityGraph(db);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ severity: "fatal", code: "slugCollision" }),
    );
  });

  it("rejects unsupported entity_redirects reasons", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);

    expect(() =>
      db.run(
        `INSERT INTO entity_redirects (source_type, source_id, target_type, target_id, reason)
         VALUES ('item-route', '/items/old', 'item', 'item-a', 'temporary')`,
      ),
    ).toThrow(/CHECK/);
  });
});
