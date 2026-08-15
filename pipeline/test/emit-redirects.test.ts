import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "$pipeline/relationships/relationship-graph";

describe("redirect graph schema", () => {
  it("creates the graph node table", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);

    expect(
      db
        .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entity_nodes'")
        .get(),
    ).toEqual({ name: "entity_nodes" });
    db.close();
  });
});
