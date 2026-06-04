import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { LOCATION_DDL } from "../src/sql/location-ddl.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { emitLocationReadModels } from "../src/entities/location/read-models.ts";

function seed(db: Database): void {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(LOCATION_DDL);
  db.exec(`
    INSERT INTO locations (
      id, game_location_id, name, enabled, map_id, source_map_position_json,
      show_on_map, show_on_map_debug_only, map_x, map_y, elevation,
      allow_fast_travel, display_on_enter_volume
    ) VALUES
      ('11111111.fixture-town', 'town', 'Harbor Town', 1, 'ardenfall',
       '{"x":12,"y":3,"z":-8}', 1, 0, 12, 8, 3, 1, 1),
      ('22222222.fixture-debug-cave', 'cave', 'Debug Cave', 1, NULL,
       '{"x":-4,"y":1,"z":6}', 1, 1, -4, -6, 1, 0, 1);
  `);
}

describe("location entity nodes", () => {
  it("emits a public node per enabled location with a map deep-link route_path", () => {
    const db = new Database(":memory:");
    seed(db);

    emitLocationReadModels(db, "/map");

    const nodes = db
      .query<{ entity_id: string; route_path: string; is_public: number; short_id: string }, []>(
        `SELECT entity_id, route_path, is_public, short_id
         FROM entity_nodes WHERE entity_type = 'location' ORDER BY entity_id`,
      )
      .all();

    expect(nodes).toHaveLength(2);
    const town = nodes.find((n) => n.entity_id === "11111111.fixture-town")!;
    expect(town.is_public).toBe(1);
    expect(town.route_path).toBe(`/map?map=ardenfall&sel=${town.short_id}`);

    const cave = nodes.find((n) => n.entity_id === "22222222.fixture-debug-cave")!;
    // No mapId -> deep link omits the map param.
    expect(cave.route_path).toBe(`/map?sel=${cave.short_id}`);
    expect(cave.is_public).toBe(1);
  });

  it("does not collide short_ids across locations", () => {
    const db = new Database(":memory:");
    seed(db);
    emitLocationReadModels(db, "/map");
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
