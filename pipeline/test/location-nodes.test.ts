import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { LOCATION_DDL } from "../src/sql/location-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { emitLocationReadModels } from "../src/entities/registry.ts";
import { emitMapReadModels } from "../src/map/read-models.ts";

function seed(db: Database): void {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(LOCATION_DDL);
  db.exec(`
    INSERT INTO locations (
      id, name, enabled, map_id, source_map_position_json,
      show_on_map, show_on_map_debug_only, allow_fast_travel
    ) VALUES
      ('11111111.fixture-town', 'Harbor Town', 1, 'ardenfall',
       '{"x":12,"y":3,"z":-8}', 1, 0, 1),
      ('22222222.fixture-debug-cave', 'Debug Cave', 1, NULL,
       '{"x":-4,"y":1,"z":6}', 0, 1, 0),
      ('33333333.fixture-hidden-grove', 'Hidden Grove', 1, NULL,
       '{"x":8,"y":1,"z":9}', 0, 0, 0);
    INSERT INTO placements (
      entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json
    ) VALUES
      ('location', '11111111.fixture-town', 'ardenfall', 12, 8, 3, '{"kind":"lookupAsset","guid":"11111111.fixture-town"}'),
      ('location', '22222222.fixture-debug-cave', NULL, -4, -6, 1, '{"kind":"lookupAsset","guid":"22222222.fixture-debug-cave"}');
  `);
}

describe("location entity nodes", () => {
  it("emits a location page node for every enabled location", () => {
    const db = new Database(":memory:");
    seed(db);
    emitLocationReadModels(db);
    emitMapReadModels(db, ["location"], "/map");

    const nodes = db
      .query<{ entity_id: string; route_path: string; has_page: number; short_id: string }, []>(
        `SELECT entity_id, route_path, has_page, short_id
         FROM entity_nodes WHERE entity_type = 'location' ORDER BY entity_id`,
      )
      .all();

    expect(nodes).toHaveLength(3);
    const town = nodes.find((n) => n.entity_id === "11111111.fixture-town")!;
    expect(town.has_page).toBe(1);
    expect(town.route_path).toBe("/locations/harbor-town--11111111");

    const cave = nodes.find((n) => n.entity_id === "22222222.fixture-debug-cave")!;
    expect(cave.route_path).toBe("/locations/debug-cave--22222222");
    expect(cave.has_page).toBe(1);

    const hidden = nodes.find((n) => n.entity_id === "33333333.fixture-hidden-grove")!;
    expect(hidden.route_path).toBe("/locations/hidden-grove--33333333");
    expect(hidden.has_page).toBe(1);
  });

  it("does not collide short_ids across locations", () => {
    const db = new Database(":memory:");
    seed(db);
    emitLocationReadModels(db);
    emitMapReadModels(db, ["location"], "/map");
    const collisions = db
      .query<{ cnt: number }, []>(
        `SELECT COUNT(*) AS cnt FROM (
           SELECT short_id FROM entity_nodes WHERE entity_type='location'
           GROUP BY short_id HAVING COUNT(*) > 1)`,
      )
      .get()!;
    expect(collisions.cnt).toBe(0);
  });
});
