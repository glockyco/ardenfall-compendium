import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { ENTITY_GRAPH_DDL } from "$pipeline/relationships/relationship-graph";
import { emitEntityDisplayLabels } from "$pipeline/stages/emit-entity-display-labels";

describe("entity display labels", () => {
  it("suffixes labels that collide within an entity type and preserves unique labels", () => {
    const db = new Database(":memory:");
    db.exec(ENTITY_GRAPH_DDL);
    db.exec(`
      INSERT INTO entity_nodes
        (entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page)
      VALUES
        ('npc', 'leader-one', 'Leader', 'Leader', '/placed-characters/leader--d998e13b', 'leader--d998e13b', 'd998e13b', 1),
        ('npc', 'leader-two', 'Leader', 'Leader', '/placed-characters/leader--de74e04b', 'leader--de74e04b', 'de74e04b', 1),
        ('npc', 'guard', 'Guard', 'Guard', '/placed-characters/guard--aabbccdd', 'guard--aabbccdd', 'aabbccdd', 1),
        ('location', 'leader-location', 'Leader', 'Leader', '/locations/leader--00112233', 'leader--00112233', '00112233', 1)
    `);

    emitEntityDisplayLabels(db);

    expect(
      db
        .query<{ entity_type: string; entity_id: string; display_label: string }, []>(
          `SELECT entity_type, entity_id, display_label
           FROM entity_nodes ORDER BY entity_type, entity_id`,
        )
        .all(),
    ).toEqual([
      { entity_type: "location", entity_id: "leader-location", display_label: "Leader" },
      { entity_type: "npc", entity_id: "guard", display_label: "Guard" },
      { entity_type: "npc", entity_id: "leader-one", display_label: "Leader · d998e13b" },
      { entity_type: "npc", entity_id: "leader-two", display_label: "Leader · de74e04b" },
    ]);

    db.close();
  });
});
