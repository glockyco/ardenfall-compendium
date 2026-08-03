import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { SnapshotRef } from "../../types.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

interface ConnectedPortalRow {
  id: string;
  connected_portal_ref_json: string;
}

/**
 * The release data marks an internal-looking name with `_`, `-`, or `.` plus
 * a lowercase start or a digit. This rule catches 29 of 33 portal rows.
 * It leaves `Ladder Door`, `Food Preserve`, and `Underground Preservium` alone.
 */
function looksLikeInternalPortalName(name: string): boolean {
  return /[_\-.]/.test(name) && (/^[a-z]/.test(name) || /\d/.test(name));
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
 * Every portal node has a page route.
 *
 * Emits nodes, presentation rows, and edges. The presentation row keeps the
 * map coordinates and the resolved destination that a portal page displays.
 */
export function emitPortalReadModels(db: Database, routeBase = "/portals"): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const writeNode = prepareEntityNodeWriter(db);
  const nodeRows = db
    .query<{ id: string; friendly_name: string | null }, []>(
      `SELECT id, friendly_name FROM portals ORDER BY COALESCE(friendly_name, 'Unnamed portal'), id`,
    )
    .all();
  const labelById = new Map(nodeRows.map((row) => [row.id, row.friendly_name ?? "Unnamed portal"]));
  const nodeTx = db.transaction(() => {
    for (const row of nodeRows) {
      const label = row.friendly_name ?? "Unnamed portal";
      if (row.friendly_name && looksLikeInternalPortalName(row.friendly_name)) {
        diagnostics.push({
          severity: "diagnostic",
          source: "portal-presentation-read-model",
          code: "portalNameLooksInternal",
          message: `Portal '${row.id}' has an authored name that looks like an internal identifier: '${row.friendly_name}'.`,
          entityType: "portal",
          entityId: row.id,
          field: "friendly_name",
          evidence: { name: row.friendly_name },
        });
      }
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "portal",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
        hasPage: true,
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

  const connectedPortalById = new Map<string, { id: string; name: string }>();
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
      connectedPortalById.set(row.id, { id: targetId, name: labelById.get(targetId)! });
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

  const presentationInsert = db.prepare(
    `INSERT INTO portal_presentation_rows (
       id, name, render_context, map_id, map_x, map_y, elevation,
       connected_portal_id, connected_portal_name
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const presentationRows = db
    .query<
      {
        id: string;
        map_id: string | null;
        map_x: number | null;
        map_y: number | null;
        elevation: number | null;
      },
      []
    >(
      `SELECT p.id, pl.map_id, pl.map_x, pl.map_y, pl.elevation
       FROM portals p
       LEFT JOIN placements pl
         ON pl.entity_id = 'portal' AND pl.instance_id = p.id
       ORDER BY p.id`,
    )
    .all();
  const presentationTx = db.transaction(() => {
    for (const row of presentationRows) {
      const connection = connectedPortalById.get(row.id);
      presentationInsert.run(
        row.id,
        labelById.get(row.id)!,
        "portal-presentation-v1",
        row.map_id,
        row.map_x,
        row.map_y,
        row.elevation,
        connection?.id ?? null,
        connection?.name ?? null,
      );
    }
  });
  presentationTx();

  return diagnostics;
}
