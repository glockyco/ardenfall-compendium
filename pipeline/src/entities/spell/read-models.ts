import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const SPELL_READ_MODEL_DDL = `
CREATE TABLE spell_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  skill      TEXT,
  mana_cost   REAL,
  is_illegal  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE spell_presentation_rows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  render_context TEXT NOT NULL,
  skill         TEXT,
  skill_id      TEXT,
  mana_cost      REAL,
  is_illegal     INTEGER NOT NULL DEFAULT 0
);
`;

interface SpellRow {
  id: string;
  spell_name: string | null;
  stat_type_ref_json: string | null;
  mana_cost: number | null;
  is_illegal: number | null;
}

interface PublicStatType {
  entity_id: string;
  label: string;
}

interface NamedAssetReference {
  entity: string;
  name: string;
}

export function emitSpellReadModels(db: Database, routeBase = "/spells"): PipelineDiagnostic[] {
  db.exec(SPELL_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const overviewInsert = db.prepare(
    `INSERT INTO spell_overview_rows (id, name, skill, mana_cost, is_illegal)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO spell_presentation_rows (
       id, name, render_context, skill, skill_id, mana_cost, is_illegal
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const publicStats = new Map(
    db
      .query<PublicStatType, []>(
        `SELECT entity_id, label FROM entity_nodes
         WHERE entity_type = 'stat-type' AND is_public = 1`,
      )
      .all()
      .map((row) => [row.entity_id, row.label] as const),
  );
  const rows = db
    .query<SpellRow, []>(
      `SELECT id, spell_name, stat_type_ref_json, mana_cost, is_illegal
       FROM spells
       ORDER BY COALESCE(spell_name, 'Unnamed spell'), id`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const presentationName = row.spell_name ?? "Unnamed spell";
      const skill = resolveSkill(row, publicStats, diagnostics);
      overviewInsert.run(
        row.id,
        presentationName,
        skill?.label ?? null,
        row.mana_cost,
        row.is_illegal ?? 0,
      );
      presentationInsert.run(
        row.id,
        presentationName,
        "spell-presentation-v1",
        skill?.label ?? null,
        skill?.id ?? null,
        row.mana_cost,
        row.is_illegal ?? 0,
      );

      const slug = deriveEntityNodeSlug(presentationName, row.id);
      // The canonical table preserves a missing display name.
      // Presentation supplies a placeholder so the public node remains routable.
      writeNode({
        entityType: "spell",
        entityId: row.id,
        label: presentationName,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });

      if (skill) {
        edgeInsert.run(
          `${row.id}:scales_with:stat-type:${skill.id}`,
          "spell",
          row.id,
          "stat-type",
          skill.id,
          "scales_with",
          "Scales with skill",
          1,
          JSON.stringify({ source: "spells.statTypeRef" }),
          null,
        );
      }
    }
  });
  tx();
  return diagnostics;
}

function resolveSkill(
  row: SpellRow,
  publicStats: Map<string, string>,
  diagnostics: PipelineDiagnostic[],
): { id: string; label: string } | null {
  if (row.stat_type_ref_json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.stat_type_ref_json) as unknown;
  } catch {
    diagnostics.push(unresolvedSkillDiagnostic(row, "reference is not valid JSON"));
    return null;
  }

  const ref = namedAssetReference(parsed);
  if (ref === null || ref.entity !== "stat-type") {
    diagnostics.push(unresolvedSkillDiagnostic(row, "reference is not a stat-type named asset"));
    return null;
  }

  const targetId = `named;${ref.entity};${ref.name}`;
  const label = publicStats.get(targetId);
  if (label === undefined) {
    diagnostics.push(
      unresolvedSkillDiagnostic(row, `target '${targetId}' is not a public stat type`),
    );
    return null;
  }
  return { id: targetId, label };
}

function namedAssetReference(value: unknown): NamedAssetReference | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const ref = value as { kind?: unknown; entity?: unknown; name?: unknown };
  if (ref.kind !== "namedAsset" || typeof ref.entity !== "string" || typeof ref.name !== "string") {
    return null;
  }
  return { entity: ref.entity, name: ref.name };
}

function unresolvedSkillDiagnostic(row: SpellRow, reason: string): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "relationship-graph",
    code: "spellSkillUnresolved",
    message: `Spell '${row.id}' has an unresolvable stat type reference: ${reason}.`,
    entityType: "spell",
    entityId: row.id,
    field: "stat_type_ref_json",
    evidence: { reason },
  };
}
