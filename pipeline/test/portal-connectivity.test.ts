import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { PORTAL_DDL } from "../src/sql/portal-ddl.ts";
import { LOCATION_DDL } from "../src/sql/location-ddl.ts";
import { ENTITY_GRAPH_DDL, auditEntityGraph } from "../src/relationships/relationship-graph.ts";
import { emitMapReadModels } from "../src/map/read-models.ts";
import { emitPortalReadModels } from "../src/entities/portal/read-models.ts";

const recordRef = (id: string) =>
  JSON.stringify({
    kind: "record",
    table: "instances",
    subtable: "portals",
    id,
    recordType: "PortalRecord",
  });

/**
 * Seeds portals plus their placements. `connections` maps a portal's short name
 * to the raw id it points at, so a test can aim an edge at something absent.
 */
function seed(
  db: Database,
  portals: { key: string; name: string | null; connectsTo?: string }[],
): Database {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(LOCATION_DDL);
  db.exec(PORTAL_DDL);
  const portalInsert = db.prepare(
    `INSERT INTO portals (id, record_ref_json, name, map_id, source_position_json, connected_portal_ref_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const placementInsert = db.prepare(
    `INSERT INTO placements (entity_id, instance_id, map_id, map_x, map_y, elevation, source_ref_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  portals.forEach((p, index) => {
    const id = `instances;portals;${p.key}`;
    portalInsert.run(
      id,
      recordRef(p.key),
      p.name,
      "ardenfall",
      '{"x":0,"y":0,"z":0}',
      p.connectsTo ? recordRef(p.connectsTo) : null,
    );
    placementInsert.run("portal", id, "ardenfall", index, index, 0, recordRef(p.key));
  });
  return db;
}

describe("portal connectivity", () => {
  it("projects each connection as one directed leads_to edge", () => {
    const db = seed(new Database(":memory:"), [
      {
        key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Harbor Gate",
        connectsTo: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        key: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        name: "Cliff Stair",
        connectsTo: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      { key: "cccccccccccccccccccccccccccccccc", name: "Sealed Door" },
    ]);
    emitMapReadModels(db, ["portal"], "/map");

    expect(emitPortalReadModels(db)).toEqual([]);

    const edges = db
      .query<{ source_id: string; target_id: string; label: string }, []>(
        `SELECT source_id, target_id, label FROM entity_edges
         WHERE predicate = 'leads_to' ORDER BY source_id`,
      )
      .all();
    // A reciprocal connection is two directed edges, not one undirected link:
    // the game also authors one-way doors, and collapsing pairs would invent a
    // return path for them.
    expect(edges).toEqual([
      {
        source_id: "instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target_id: "instances;portals;bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        label: "Leads to",
      },
      {
        source_id: "instances;portals;bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        target_id: "instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Leads to",
      },
    ]);
    // The unconnected portal contributes nothing rather than a self-edge.
    expect(edges.some((e) => e.source_id.endsWith("cccccccccccccccccccccccccccccccc"))).toBe(false);
  });

  it("carries the destination label and route into the relationship section", () => {
    const db = seed(new Database(":memory:"), [
      {
        key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Harbor Gate",
        connectsTo: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      { key: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", name: "Cliff Stair" },
    ]);
    emitMapReadModels(db, ["portal"], "/map");
    emitPortalReadModels(db);

    const section = db
      .query<{ title: string; edges_json: string }, []>(
        `SELECT title, edges_json FROM entity_relationship_sections
         WHERE source_id = 'instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'`,
      )
      .get()!;
    const edges = JSON.parse(section.edges_json) as {
      targetLabel: string;
      targetRoutePath: string;
    }[];
    expect(section.title).toBe("Leads to");
    expect(edges[0]?.targetLabel).toBe("Cliff Stair");
    expect(edges[0]?.targetRoutePath).toMatch(/^\/map\?map=ardenfall&sel=[0-9a-f]{8}$/);
  });

  it("reports an unresolvable connection instead of emitting a dangling edge", () => {
    const db = seed(new Database(":memory:"), [
      {
        key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "Harbor Gate",
        connectsTo: "99999999999999999999999999999999",
      },
    ]);
    emitMapReadModels(db, ["portal"], "/map");

    const diagnostics = emitPortalReadModels(db);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("portalConnectionUnresolved");
    expect(diagnostics[0]?.severity).toBe("diagnostic");
    expect(diagnostics[0]?.message).toContain("instances;portals;99999999999999999999999999999999");
    // No edge was written, so the graph audit stays clean: an unresolvable
    // reference is reported once, not escalated into a fatal missing target.
    expect(db.query(`SELECT COUNT(*) AS c FROM entity_edges`).get()).toEqual({ c: 0 });
    expect(auditEntityGraph(db)).toEqual([]);
  });

  it("labels a portal the game never named without inventing an identifier", () => {
    const db = seed(new Database(":memory:"), [
      { key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: null },
    ]);
    emitMapReadModels(db, ["portal"], "/map");

    // The canonical row keeps the absence; only presentation fills it in, so a
    // row id can never masquerade as an authored name.
    expect(db.query(`SELECT name FROM portals`).get()).toEqual({ name: null });
    const node = db
      .query<{ label: string; canonical_slug: string }, []>(
        `SELECT label, canonical_slug FROM entity_nodes WHERE entity_type = 'portal'`,
      )
      .get()!;
    expect(node.label).toBe("Unnamed portal");
    expect(node.canonical_slug).toMatch(/^unnamed-portal--/);
  });
});
