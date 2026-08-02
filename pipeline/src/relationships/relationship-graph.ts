import type { Database } from "bun:sqlite";

/**
 * Pipeline diagnostic source taxonomy for Slice 4.5:
 * - `rich-text`: rich-text parser/linker diagnostics while translating game-authored strings.
 * - `relationship-graph`: entity node, edge, slug, and public-link invariant audits.
 * - `master-tooltip`: master-tooltip vocabulary extraction or schema diagnostics.
 * - `composer`: tooltip composer parity, binding, and deterministic rendering diagnostics.
 * - `entity-extraction`: per-entity snapshot extraction diagnostics from mod or pipeline loaders.
 * - `slug-collision`: route slug/short-id collision diagnostics before public route emission.
 * - `effect-binding`: unresolved tooltip variable/effect payload binding diagnostics.
 */

export const ENTITY_GRAPH_DDL = `
CREATE TABLE IF NOT EXISTS entity_nodes (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL,
  route_path TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  short_id TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_nodes_slug
  ON entity_nodes (entity_type, canonical_slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_nodes_short_id
  ON entity_nodes (entity_type, short_id);
CREATE TABLE IF NOT EXISTS entity_aliases (
  alias_key TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'generated',
  PRIMARY KEY (alias_key, target_type, target_id)
);
CREATE TABLE IF NOT EXISTS entity_redirects (
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('legacy-id', 'name-changed', 'merged')),
  PRIMARY KEY (source_type, source_id)
);
CREATE TABLE IF NOT EXISTS entity_edges (
  edge_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  label TEXT NOT NULL,
  weight REAL NOT NULL,
  evidence_json TEXT NOT NULL,
  anchor TEXT
);
CREATE TABLE IF NOT EXISTS entity_relationship_sections (
  section_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  predicate TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pipeline_diagnostics (
  diagnostic_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  source TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('fatal', 'diagnostic')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  field TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}'
);
`;

export type PipelineDiagnostic = {
  severity: "fatal" | "diagnostic";
  code: string;
  source: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  field?: string | null;
  evidence?: unknown;
};

export function auditEntityGraph(db: Database): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  for (const row of db
    .query<
      {
        edge_id: string;
        source_type: string;
        source_id: string;
        target_type: string;
        target_id: string;
      },
      []
    >(
      `SELECT edge_id, source_type, source_id, target_type, target_id
       FROM entity_edges e
       WHERE NOT EXISTS (
         SELECT 1 FROM entity_nodes n
         WHERE n.entity_type = e.target_type AND n.entity_id = e.target_id AND n.is_public = 1
       )`,
    )
    .all()) {
    diagnostics.push({
      severity: "fatal",
      source: "relationship-graph",
      code: "relationshipMissingTarget",
      message: `Relationship edge '${row.edge_id}' targets non-public or missing ${row.target_type}:${row.target_id}.`,
      entityType: row.source_type,
      entityId: row.source_id,
      field: "entity_edges.target_id",
      evidence: { edgeId: row.edge_id, targetType: row.target_type, targetId: row.target_id },
    });
  }
  for (const row of db
    .query<{ entity_type: string; short_id: string; cnt: number }, []>(
      `SELECT entity_type, short_id, COUNT(*) AS cnt
       FROM entity_nodes
       GROUP BY entity_type, short_id
       HAVING COUNT(*) > 1`,
    )
    .all()) {
    diagnostics.push({
      severity: "fatal",
      source: "relationship-graph",
      code: "slugCollision",
      message: `short_id '${row.short_id}' collides ${row.cnt} times within entity_type '${row.entity_type}'.`,
      entityType: row.entity_type,
      entityId: null,
      field: "entity_nodes.short_id",
      evidence: { shortId: row.short_id, occurrences: row.cnt },
    });
  }

  return diagnostics;
}

export function insertPipelineDiagnostics(
  db: Database,
  diagnostics: PipelineDiagnostic[],
  artifactId: string,
) {
  const insert = db.query(
    `INSERT INTO pipeline_diagnostics (
      diagnostic_id, artifact_id, source, severity, code, message, entity_type, entity_id, field, evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let index = 0;
  for (const diagnostic of diagnostics) {
    insert.run(
      `${artifactId}:${diagnostic.source}:${diagnostic.code}:${index++}`,
      artifactId,
      diagnostic.source,
      diagnostic.severity,
      diagnostic.code,
      diagnostic.message,
      diagnostic.entityType ?? null,
      diagnostic.entityId ?? null,
      diagnostic.field ?? null,
      JSON.stringify(diagnostic.evidence ?? {}),
    );
  }
}
