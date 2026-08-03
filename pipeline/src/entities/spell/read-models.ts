import type { Database } from "bun:sqlite";
import type { MasterTooltipVocabulary } from "../../types.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
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
  is_illegal     INTEGER NOT NULL DEFAULT 0,
  tooltip_source TEXT,
  tooltip_rich_text_json TEXT
);
`;

interface SpellRow {
  id: string;
  spell_name: string | null;
  stat_type_ref_json: string | null;
  mana_cost: number | null;
  is_illegal: number | null;
  tooltip_source: string | null;
}

interface PageStatType {
  entity_id: string;
  label: string;
  grouping: "attribute" | "skill";
}

interface NamedAssetReference {
  entity: string;
  name: string;
}

export function emitSpellReadModels(
  db: Database,
  routeBase = "/spells",
  masterTooltip?: MasterTooltipVocabulary,
): PipelineDiagnostic[] {
  db.exec(SPELL_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);

  const overviewInsert = db.prepare(
    `INSERT INTO spell_overview_rows (id, name, skill, mana_cost, is_illegal)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO spell_presentation_rows (
       id, name, render_context, skill, skill_id, mana_cost, is_illegal,
       tooltip_source, tooltip_rich_text_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const pageStats = new Map<string, PageStatType>();
  const hasStatTypeOverviewTable = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stat_type_overview_rows'`,
    )
    .get();
  if (hasStatTypeOverviewTable) {
    for (const row of db
      .query<PageStatType, []>(
        `SELECT n.entity_id, n.label, o.grouping
         FROM entity_nodes n
         JOIN stat_type_overview_rows o ON o.id = n.entity_id
         WHERE n.entity_type = 'stat-type' AND n.has_page = 1`,
      )
      .all()) {
      pageStats.set(row.entity_id, row);
    }
  }
  const rows = db
    .query<SpellRow, []>(
      `SELECT id, spell_name, stat_type_ref_json, mana_cost, is_illegal, tooltip_source
       FROM spells
       ORDER BY COALESCE(spell_name, 'Unnamed spell'), id`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const presentationName = row.spell_name ?? "Unnamed spell";
      const skill = resolveSkill(row, pageStats, diagnostics);
      const tooltip =
        row.tooltip_source === null
          ? null
          : translateRichTextV1(row.tooltip_source, {
              ...(masterTooltip
                ? {
                    tooltipCodes: masterTooltip.tooltipCodes,
                    tooltipColors: masterTooltip.tooltipColors,
                  }
                : {}),
            });
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
        row.tooltip_source,
        tooltip === null ? null : JSON.stringify(tooltip),
      );
      const slug = deriveEntityNodeSlug(presentationName, row.id);
      // The canonical table preserves a missing display name.
      // Presentation supplies a placeholder so the page node remains routable.
      writeNode({
        entityType: "spell",
        entityId: row.id,
        label: presentationName,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });

      for (const diagnostic of tooltip?.diagnostics ?? []) {
        diagnostics.push({
          severity: diagnostic.severity,
          source: "rich-text",
          code: diagnostic.code,
          message: diagnostic.message,
          entityType: "spell",
          entityId: row.id,
          field: diagnostic.field,
        });
      }

      if (skill) {
        edgeInsert.run(
          `${row.id}:scales_with:stat-type:${skill.id}`,
          "spell",
          row.id,
          "stat-type",
          skill.id,
          "scales_with",
          "Scales with " + skill.grouping,
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
  pageStats: Map<string, PageStatType>,
  diagnostics: PipelineDiagnostic[],
): { id: string; label: string; grouping: "attribute" | "skill" } | null {
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
  const stat = pageStats.get(targetId);
  if (stat === undefined) {
    diagnostics.push(
      unresolvedSkillDiagnostic(row, `target '${targetId}' is a stat type without a page`),
    );
    return null;
  }
  return { id: targetId, label: stat.label, grouping: stat.grouping };
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
