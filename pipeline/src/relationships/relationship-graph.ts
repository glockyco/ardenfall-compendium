import type { Database } from "bun:sqlite";

export const ENTITY_GRAPH_DDL = `
CREATE TABLE IF NOT EXISTS entity_nodes (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL,
  route_path TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_type, entity_id)
);
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
  reason TEXT NOT NULL,
  PRIMARY KEY (source_type, source_id)
);
CREATE TABLE IF NOT EXISTS entity_disambiguations (
  term_key TEXT PRIMARY KEY,
  options_json TEXT NOT NULL
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

export type DisambiguationOption = {
  targetType: string;
  targetId: string;
  label: string;
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
  return diagnostics;
}

export function insertDisambiguationForDuplicateAliases(
  termKey: string,
  options: DisambiguationOption[],
): { termKey: string; optionsJson: string } {
  return { termKey, optionsJson: JSON.stringify(options) };
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

export function countPipelineDiagnostics(db: Database, source: string): number {
  return (
    db
      .query<
        { count: number },
        [string]
      >("SELECT count(*) AS count FROM pipeline_diagnostics WHERE source = ?")
      .get(source)?.count ?? 0
  );
}
