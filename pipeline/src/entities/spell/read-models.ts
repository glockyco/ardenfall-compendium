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
  display_icon_hash TEXT,
  skill         TEXT,
  skill_id      TEXT,
  mana_cost      REAL,
  is_illegal     INTEGER NOT NULL DEFAULT 0,
  tooltip_source TEXT,
  tooltip_rich_text_json TEXT,
  effects_json   TEXT NOT NULL
);
`;

interface SpellRow {
  id: string;
  spell_name: string | null;
  stat_type_ref_json: string | null;
  mana_cost: number | null;
  is_illegal: number | null;
  tooltip_source: string | null;
  icon_ref_json: string | null;
  display_icon_hash: string | null;
}

interface PageStatType {
  entity_id: string;
  label: string;
  grouping: "attribute" | "skill";
}

interface SpellEffectRow {
  spell_id: string;
  effect_ordinal: number;
  kind: string;
  status_effect_ref_json: string | null;
  level: number | null;
  lifetime: number | null;
  applies_to_self: number | null;
  damage: number | null;
  damage_type: string | null;
}

interface SpellEffectPresentation {
  kind: string;
  statusEffectId: string | null;
  statusEffectLabel: string | null;
  statusEffectRoutePath: string | null;
  sampleLevel: number | null;
  sampleLifetimeSeconds: number | null;
  appliesToSelf: boolean | null;
  damage: number | null;
  damageType: string | null;
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
       id, name, render_context, display_icon_hash, skill, skill_id, mana_cost, is_illegal,
       tooltip_source, tooltip_rich_text_json, effects_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      `SELECT s.id, s.spell_name, s.stat_type_ref_json, s.mana_cost, s.is_illegal,
              s.tooltip_source, s.icon_ref_json,
              icon.asset_hash AS display_icon_hash
       FROM spells s
       LEFT JOIN asset_refs icon
         ON icon.entity_id = 'spell'
        AND icon.entity_row_id = s.id
        AND icon.slot = 'iconRef'
        AND icon.asset_kind = 'image'
       ORDER BY COALESCE(NULLIF(TRIM(s.spell_name), ''), 'Unnamed spell'), s.id`,
    )
    .all();
  const statusEffects = new Map<string, { label: string | null }>();
  const hasStatusEffectsTable = db
    .query<{ name: string }, []>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'status_effects'`,
    )
    .get();
  if (hasStatusEffectsTable) {
    for (const status of db
      .query<{ id: string; status_effect_name: string | null }, []>(
        `SELECT id, status_effect_name FROM status_effects`,
      )
      .all()) {
      statusEffects.set(status.id, { label: status.status_effect_name });
    }
  }
  const effectsBySpell = new Map<string, SpellEffectRow[]>();
  for (const effect of db
    .query<SpellEffectRow, []>(
      `SELECT spell_id, effect_ordinal, kind, status_effect_ref_json,
              level, lifetime, applies_to_self, damage, damage_type
       FROM spell_effects ORDER BY spell_id, effect_ordinal`,
    )
    .all()) {
    const effects = effectsBySpell.get(effect.spell_id) ?? [];
    effects.push(effect);
    effectsBySpell.set(effect.spell_id, effects);
  }

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const presentationName = row.spell_name?.trim() || "Unnamed spell";
      if (hasAuthoredIconReference(row.icon_ref_json) && row.display_icon_hash === null) {
        diagnostics.push({
          severity: "diagnostic",
          source: "spell-read-model",
          code: "spellIconUnresolved",
          message: `Spell '${row.id}' has an unresolvable icon reference.`,
          entityType: "spell",
          entityId: row.id,
          field: "spells.icon_ref_json",
          evidence: { iconRef: row.icon_ref_json },
        });
      }
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

      const effectFacts: SpellEffectPresentation[] = (effectsBySpell.get(row.id) ?? []).map(
        (effect) => {
          const statusEffectCandidate = resolveStatusEffectId(effect.status_effect_ref_json);
          let statusEffectId: string | null = null;
          let statusEffectLabel: string | null = null;
          let statusEffectRoutePath: string | null = null;
          if (effect.status_effect_ref_json !== null) {
            if (statusEffectCandidate === null || !statusEffects.has(statusEffectCandidate)) {
              diagnostics.push({
                severity: "diagnostic",
                source: "spell-effect-read-model",
                code: "spellEffectStatusUnresolved",
                message: `Spell '${row.id}' has an unresolvable status effect reference.`,
                entityType: "spell",
                entityId: row.id,
                field: "spells.spellEffects.statusEffectRef",
                evidence: { statusEffectRef: effect.status_effect_ref_json },
              });
            } else {
              statusEffectLabel =
                statusEffects.get(statusEffectCandidate)?.label ?? "Unnamed status effect";
              statusEffectId = statusEffectCandidate;
              const slug = deriveEntityNodeSlug(statusEffectLabel, statusEffectId);
              statusEffectRoutePath = `/status-effects/${slug.canonicalSlug}`;
              edgeInsert.run(
                `${row.id}:applies:status-effect:${statusEffectId}`,
                "spell",
                row.id,
                "status-effect",
                statusEffectId,
                "applies",
                "Applies",
                1,
                JSON.stringify({
                  source: "spells.spellEffects",
                  level: effect.level,
                }),
                null,
              );
            }
          }
          return {
            kind: effect.kind,
            statusEffectId,
            statusEffectLabel,
            statusEffectRoutePath,
            sampleLevel: effect.level,
            sampleLifetimeSeconds: effect.lifetime,
            appliesToSelf: effect.applies_to_self === null ? null : effect.applies_to_self === 1,
            damage: effect.damage,
            damageType: effect.damage_type,
          };
        },
      );

      presentationInsert.run(
        row.id,
        presentationName,
        "spell-presentation-v1",
        row.display_icon_hash,
        skill?.label ?? null,
        skill?.id ?? null,
        row.mana_cost,
        row.is_illegal ?? 0,
        row.tooltip_source,
        tooltip === null ? null : JSON.stringify(tooltip),
        JSON.stringify(effectFacts),
      );

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

function resolveStatusEffectId(value: string | null): string | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const ref = parsed as { kind?: unknown; guid?: unknown; entity?: unknown; name?: unknown };
  if (ref.kind === "lookupAsset" && typeof ref.guid === "string") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === "status-effect" && typeof ref.name === "string") {
    return `named;status-effect;${ref.name}`;
  }
  return null;
}

function hasAuthoredIconReference(value: string | null): boolean {
  if (value === null) return false;
  try {
    const parsed = JSON.parse(value) as { kind?: unknown };
    return parsed.kind !== "missing";
  } catch {
    return true;
  }
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
