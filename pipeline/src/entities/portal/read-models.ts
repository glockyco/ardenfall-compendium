import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

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
 * Must run after the map read models, which create the graph tables. This
 * emitter creates portal nodes from canonical rows before it projects edges.
 * An edge can target a node without a page because `has_page` means that an entity
 * has a page.
 *
 * Emits nodes and edges. `entity_relationship_sections` is the grouping
 * contract for a detail page, and a portal has no page. The map panel resolves
 * its destination by joining the edge to its target node.
 */
export function emitPortalReadModels(db: Database): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const writeNode = prepareEntityNodeWriter(db);
  const nodeRows = db
    .query<{ id: string; friendly_name: string | null; map_id: string | null }, []>(
      `SELECT id, friendly_name, map_id FROM portals ORDER BY COALESCE(friendly_name, 'Unnamed portal'), id`,
    )
    .all();
  const nodeTx = db.transaction(() => {
    for (const row of nodeRows) {
      const label = row.friendly_name ?? "Unnamed portal";
      const slug = deriveEntityNodeSlug(label, row.id);
      const query = row.map_id
        ? `map=${encodeURIComponent(row.map_id)}&sel=${slug.shortId}`
        : `sel=${slug.shortId}`;
      writeNode({
        entityType: "portal",
        entityId: row.id,
        label,
        routePath: `/map?${query}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: false,
      });
    }
  });
  nodeTx();

  const portalIds = new Set(
    db
      .query<{ entity_id: string }, []>(
        `SELECT entity_id FROM entity_nodes
         WHERE entity_type = 'portal'`,
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
      if (!portalIds.has(targetId)) {
        // Skipping keeps one unresolvable reference from failing the whole
        // artifact through the graph audit, but the gap stays counted and named.
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "portalConnectionUnresolved",
          message: `Portal '${row.id}' connects to '${targetId}', which is not a portal node.`,
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
