import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const FACTION_READ_MODEL_DDL = `
CREATE TABLE faction_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL
);
CREATE TABLE faction_presentation_rows (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  render_context      TEXT NOT NULL,
  description         TEXT NOT NULL,
  icon_ref_json       TEXT,
  alliable            INTEGER NOT NULL,
  enable_reputation   INTEGER NOT NULL,
  always_show_in_ui   INTEGER NOT NULL,
  can_be_disguised    INTEGER NOT NULL,
  enable_bounty       INTEGER NOT NULL
);
`;

interface FactionRow {
  id: string;
  name: string | null;
  description: string;
  icon_ref_json: string | null;
  alliable: number;
  enable_reputation: number;
  always_show_in_ui: number;
  can_be_disguised: number;
  enable_bounty: number;
}

interface FactionRelationshipRow {
  id: string;
  source_faction_id: string;
  target_faction_id: string | null;
  relationship: number;
  is_enemy: number;
}

export function emitFactionReadModels(db: Database, routeBase = "/factions"): PipelineDiagnostic[] {
  db.exec(FACTION_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const overviewInsert = db.prepare(
    `INSERT INTO faction_overview_rows (id, name, description) VALUES (?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO faction_presentation_rows (
      id, name, render_context, description, icon_ref_json, alliable, enable_reputation,
      always_show_in_ui, can_be_disguised, enable_bounty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<FactionRow, []>(
      `SELECT id, name, description, icon_ref_json, alliable, enable_reputation,
              always_show_in_ui, can_be_disguised, enable_bounty
       FROM factions
       ORDER BY COALESCE(name, 'Unnamed faction'), id`,
    )
    .all();
  const factionIds = new Set(rows.map((row) => row.id));
  const relationships = db
    .query<FactionRelationshipRow, []>(
      `SELECT id, source_faction_id, target_faction_id, relationship, is_enemy
       FROM faction_relationships
       ORDER BY id`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const label = row.name ?? "Unnamed faction";
      overviewInsert.run(row.id, label, row.description);
      presentationInsert.run(
        row.id,
        label,
        "faction-presentation-v1",
        row.description,
        row.icon_ref_json,
        row.alliable,
        row.enable_reputation,
        row.always_show_in_ui,
        row.can_be_disguised,
        row.enable_bounty,
      );
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "faction",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }

    for (const relationship of relationships) {
      const targetId = relationship.target_faction_id;
      if (targetId === null || !factionIds.has(targetId)) {
        diagnostics.push({
          severity: "diagnostic",
          source: "relationship-graph",
          code: "factionRelationshipUnresolved",
          message: `Faction '${relationship.source_faction_id}' has an unresolvable related faction reference.`,
          entityType: "faction",
          entityId: relationship.source_faction_id,
          field: "faction_relationships.target_faction_id",
          evidence: { relationshipId: relationship.id, targetId },
        });
        continue;
      }
      const label = relationship.is_enemy ? "Enemy" : `Standing ${relationship.relationship}`;
      edgeInsert.run(
        `${relationship.source_faction_id}:starts_opposed_to:faction:${targetId}`,
        "faction",
        relationship.source_faction_id,
        "faction",
        targetId,
        "starts_opposed_to",
        label,
        1,
        JSON.stringify({
          source: "factions.interFactionRelationships",
          relationship: relationship.relationship,
          isEnemy: relationship.is_enemy === 1,
        }),
        null,
      );
    }
  });
  tx();
  return diagnostics;
}
