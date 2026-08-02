import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";

interface ConnectedPortalRow {
  id: string;
  connected_portal_ref_json: string;
}

/**
 * Projects the canonical `portals.connected_portal_ref_json` into `leads_to`
 * relationship edges so the map can express zone connectivity.
 *
 * The relation is directed deliberately. Most connections are authored as
 * reciprocal pairs, but the game also contains chains and one-way doors, so
 * collapsing a pair into a single undirected link would invent return paths the
 * world does not have. A reciprocal connection is simply two edges.
 *
 * Must run after the map read models, which are what publish portal entity
 * nodes; an edge may only target a public node.
 *
 * Emits edges only. `entity_relationship_sections` is the grouping contract for
 * a detail page, and a portal has no page: the map panel resolves its single
 * destination by joining the edge to its target node.
 */
export function emitPortalReadModels(db: Database): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const publicPortalIds = new Set(
    db
      .query<{ entity_id: string }, []>(
        `SELECT entity_id FROM entity_nodes
         WHERE entity_type = 'portal' AND is_public = 1`,
      )
      .all()
      .map((row) => row.entity_id),
  );

  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (edge_id, source_type, source_id, target_type, target_id, predicate, label, weight, evidence_json, anchor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const rows = db
    .query<ConnectedPortalRow, []>(
      `SELECT id, connected_portal_ref_json FROM portals
       WHERE connected_portal_ref_json IS NOT NULL
       ORDER BY id`,
    )
    .all();

  const tx = db.transaction(() => {
    for (const row of rows) {
      const ref = JSON.parse(row.connected_portal_ref_json) as SnapshotRef;
      if (ref.kind !== "record") {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "portalConnectionNotARecord",
          message: `Portal '${row.id}' connects via a '${ref.kind}' reference; only record references identify a portal.`,
          entityType: "portal",
          entityId: row.id,
          field: "connected_portal_ref_json",
          evidence: { kind: ref.kind },
        });
        continue;
      }
      const targetId = `${ref.table};${ref.subtable};${ref.id}`;
      if (!publicPortalIds.has(targetId)) {
        // Skipping keeps one unresolvable reference from failing the whole
        // artifact through the graph audit, but the gap stays counted and named.
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "portalConnectionUnresolved",
          message: `Portal '${row.id}' connects to '${targetId}', which is not a public portal.`,
          entityType: "portal",
          entityId: row.id,
          field: "connected_portal_ref_json",
          evidence: { targetId },
        });
        continue;
      }
      edgeInsert.run(
        `${row.id}:leads_to:portal:${targetId}`,
        "portal",
        row.id,
        "portal",
        targetId,
        "leads_to",
        "Leads to",
        1,
        JSON.stringify({ source: "portals.connectedPortalRef" }),
        null,
      );
    }
  });
  tx();

  return diagnostics;
}
