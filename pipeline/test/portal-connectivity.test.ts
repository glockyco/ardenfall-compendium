import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import type { SnapshotEnvelope } from "../src/types.ts";
import { LOCATION_DDL } from "../src/sql/location-ddl.ts";
import { PORTAL_DDL } from "../src/sql/portal-ddl.ts";
import { ENTITY_GRAPH_DDL, auditEntityGraph } from "../src/relationships/relationship-graph.ts";
import { emitMapReadModels } from "../src/map/read-models.ts";
import { canonicalisePortals } from "../src/entities/portal/canonicaliser.ts";
import { emitPortalReadModels } from "../src/entities/portal/read-models.ts";

function canonicalPortalRows(source: SnapshotEnvelope) {
  const db = new Database(":memory:");
  db.exec(`${PORTAL_DDL}
    CREATE TABLE placements (
      entity_id TEXT NOT NULL, instance_id TEXT NOT NULL, map_id TEXT,
      map_x REAL NOT NULL, map_y REAL NOT NULL, elevation REAL NOT NULL,
      source_ref_json TEXT NOT NULL, PRIMARY KEY (entity_id, instance_id)
    );`);
  canonicalisePortals(db, source);
  const rows = {
    portals: db.query(`SELECT * FROM portals`).all(),
    placements: db.query(`SELECT * FROM placements`).all(),
  };
  db.close();
  return rows;
}

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
  portals: { key: string; friendlyName: string | null; connectsTo?: string }[],
): Database {
  db.exec(ENTITY_GRAPH_DDL);
  db.exec(LOCATION_DDL);
  db.exec(PORTAL_DDL);
  const portalInsert = db.prepare(
    `INSERT INTO portals (id, record_ref_json, friendly_name, map_id, source_position_json, connected_portal_ref_json)
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
      p.friendlyName,
      "ardenfall",
      '{"x":0,"y":0,"z":0}',
      p.connectsTo ? recordRef(p.connectsTo) : null,
    );
    placementInsert.run("portal", id, "ardenfall", index, index, 0, recordRef(p.key));
  });
  return db;
}

describe("portal connectivity", () => {
  it("canonicalises portal rows independent of arrival order", () => {
    const source: SnapshotEnvelope = {
      entityId: "portal",
      schemaVersion: 1,
      rows: [
        {
          id: "instances;portals;bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          fields: {
            id: "instances;portals;bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            recordRef: {
              kind: "record",
              table: "instances",
              subtable: "portals",
              id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
            friendlyName: "Cliff Stair",
            mapId: "ardenfall",
            position: { x: 1, y: 2, z: 3 },
            connectedPortalRef: null,
          },
        },
        {
          id: "instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          fields: {
            id: "instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            recordRef: {
              kind: "record",
              table: "instances",
              subtable: "portals",
              id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
            friendlyName: "Harbor Gate",
            mapId: "ardenfall",
            position: { x: 4, y: 5, z: 6 },
            connectedPortalRef: null,
          },
        },
      ],
    };
    const reversed: SnapshotEnvelope = { ...source, rows: [...source.rows].reverse() };

    expect(canonicalPortalRows(reversed)).toEqual(canonicalPortalRows(source));
  });

  it("projects each connection as one directed leads_to edge", () => {
    const db = seed(new Database(":memory:"), [
      {
        key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        friendlyName: "Harbor Gate",
        connectsTo: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        key: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        friendlyName: "Cliff Stair",
        connectsTo: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      { key: "cccccccccccccccccccccccccccccccc", friendlyName: "Sealed Door" },
    ]);
    emitMapReadModels(db, ["portal"], "/map");

    expect(emitPortalReadModels(db)).toEqual([]);
    expect(
      db
        .query<{ count: number; hasPageCount: number }, []>(
          `SELECT COUNT(*) AS count, COALESCE(SUM(has_page), 0) AS hasPageCount
           FROM entity_nodes WHERE entity_type = 'portal'`,
        )
        .get(),
    ).toEqual({ count: 3, hasPageCount: 3 });
    expect(
      db
        .query<{ route_path: string; has_page: number }, [string]>(
          `SELECT route_path, has_page FROM entity_nodes
           WHERE entity_type = 'portal' AND entity_id = ?`,
        )
        .get("instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ).toEqual({
      route_path: "/portals/harbor-gate--aaaaaaaa",
      has_page: 1,
    });
    expect(
      db
        .query<
          {
            name: string;
            map_id: string | null;
            map_x: number | null;
            map_y: number | null;
            elevation: number | null;
            connected_portal_id: string | null;
            connected_portal_name: string | null;
          },
          [string]
        >(
          `SELECT name, map_id, map_x, map_y, elevation,
                  connected_portal_id, connected_portal_name
           FROM portal_presentation_rows WHERE id = ?`,
        )
        .get("instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ).toEqual({
      name: "Harbor Gate",
      map_id: "ardenfall",
      map_x: 0,
      map_y: 0,
      elevation: 0,
      connected_portal_id: "instances;portals;bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      connected_portal_name: "Cliff Stair",
    });

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

  it("writes no relationship section because the portal connection is an edge", () => {
    const db = seed(new Database(":memory:"), [
      {
        key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        friendlyName: "Harbor Gate",
        connectsTo: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      { key: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", friendlyName: "Cliff Stair" },
    ]);
    emitMapReadModels(db, ["portal"], "/map");
    emitPortalReadModels(db);

    // `entity_relationship_sections` groups relationships for a detail page and
    // denormalises the target's label into JSON. A portal page reads its destination
    // from the portal presentation row, so a section would be a second copy.
    expect(db.query(`SELECT COUNT(*) AS c FROM entity_relationship_sections`).get()).toEqual({
      c: 0,
    });
    // The edge still resolves to a portal page node and the presentation row carries its label.
    const destination = db
      .query<{ label: string; short_id: string }, []>(
        `SELECT n.label, n.short_id
         FROM entity_edges e
         JOIN entity_nodes n ON n.entity_type = e.target_type AND n.entity_id = e.target_id
         WHERE e.predicate = 'leads_to'`,
      )
      .get()!;
    expect(destination.label).toBe("Cliff Stair");
    expect(destination.short_id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("reports an unresolvable connection instead of emitting a dangling edge", () => {
    const db = seed(new Database(":memory:"), [
      {
        key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        friendlyName: "Harbor Gate",
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

  it("diagnoses authored names that look like internal identifiers", () => {
    const db = seed(new Database(":memory:"), [
      { key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", friendlyName: "sc_tutcave_ext" },
      { key: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", friendlyName: "Food Preserve" },
    ]);
    emitMapReadModels(db, ["portal"], "/map");

    const diagnostics = emitPortalReadModels(db);

    expect(
      diagnostics.filter((diagnostic) => diagnostic.code === "portalNameLooksInternal"),
    ).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "portalNameLooksInternal",
      entityId: "instances;portals;aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("labels a portal the game never named without inventing an identifier", () => {
    const db = seed(new Database(":memory:"), [
      { key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", friendlyName: null },
    ]);
    emitMapReadModels(db, ["portal"], "/map");
    emitPortalReadModels(db);

    // The canonical row keeps the absence; only presentation fills it in, so a
    // row id can never masquerade as an authored name.
    expect(db.query(`SELECT friendly_name FROM portals`).get()).toEqual({ friendly_name: null });
    const node = db
      .query<{ label: string; canonical_slug: string }, []>(
        `SELECT label, canonical_slug FROM entity_nodes WHERE entity_type = 'portal'`,
      )
      .get()!;
    expect(node.label).toBe("Unnamed portal");
    expect(node.canonical_slug).toMatch(/^unnamed-portal--/);
  });
});
