import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../relationships/relationship-graph.ts";
import type { PlacedOwnersSnapshot, SnapshotRef } from "../types.ts";

/**
 * Projects the authored owners of placed objects as `owned_by` edges.
 *
 * Ownership is authorship, not consequence: the edge says who the game records as the owner, and
 * says nothing about whether taking the object is a crime, which depends on witnesses and faction
 * state at runtime.
 *
 * A faction owner is an authored asset and a character owner is a record reference to a placed
 * character, so both resolve against entities the compendium already publishes. An owner that does
 * not resolve is diagnosed rather than invented.
 */
export function emitOwnershipEdges(
  db: Database,
  entityType: "placed-item" | "placed-container",
  sourceTable: string,
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const rows = db
    .query<{ id: string; owners_json: string }, []>(
      `SELECT id, owners_json FROM ${sourceTable} ORDER BY id`,
    )
    .all();
  const factions = new Set(
    db
      .query<{ id: string }, []>(`SELECT id FROM factions`)
      .all()
      .map((row) => row.id),
  );
  const characters = new Set(
    db
      .query<{ id: string }, []>(`SELECT id FROM npcs`)
      .all()
      .map((row) => row.id),
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
      edge_id, source_type, source_id, target_type, target_id, predicate, label, weight,
      evidence_json, anchor
    ) VALUES (?, ?, ?, ?, ?, 'owned_by', ?, 1, ?, NULL)`,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const owners = JSON.parse(row.owners_json) as PlacedOwnersSnapshot;
      for (const reference of owners.factionRefs) {
        const factionId = assetId(reference);
        if (factionId === null || !factions.has(factionId)) {
          diagnostics.push(unresolved(entityType, row.id, "faction"));
          continue;
        }
        edgeInsert.run(
          `${entityType}:${row.id}|owned_by|faction:${factionId}`,
          entityType,
          row.id,
          "faction",
          factionId,
          "Faction owner",
          JSON.stringify({ via: "factionOwners" }),
        );
      }

      for (const reference of owners.characterRefs) {
        const characterId = recordId(reference);
        if (characterId === null || !characters.has(characterId)) {
          diagnostics.push(unresolved(entityType, row.id, "character"));
          continue;
        }
        edgeInsert.run(
          `${entityType}:${row.id}|owned_by|npc:${characterId}`,
          entityType,
          row.id,
          "npc",
          characterId,
          "Owner",
          JSON.stringify({ via: "characterOwners" }),
        );
      }
    }
  });
  tx();

  return diagnostics;
}

function unresolved(
  entityType: string,
  entityId: string,
  kind: "faction" | "character",
): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code: "placedOwnerUnresolved",
    message: `${entityType} '${entityId}' names a ${kind} owner the snapshot does not carry.`,
    entityType,
    entityId,
    field: "owners_json",
    evidence: { kind },
  };
}

function assetId(ref: Partial<SnapshotRef>): string | null {
  return ref.kind === "lookupAsset" && typeof ref.guid === "string" ? ref.guid : null;
}

function recordId(ref: Partial<SnapshotRef>): string | null {
  return ref.kind === "record" && typeof ref.id === "string" ? ref.id : null;
}
