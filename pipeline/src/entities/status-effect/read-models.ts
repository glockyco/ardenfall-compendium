import type { Database } from "bun:sqlite";
import type { MasterTooltipVocabulary } from "../../types.ts";
import { translateRichTextV1 } from "../../rich-text/rich-text-v1.ts";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const STATUS_EFFECT_READ_MODEL_DDL = `
CREATE TABLE status_effect_overview_rows (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  is_hostile INTEGER
);
CREATE TABLE status_effect_presentation_rows (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  render_context         TEXT NOT NULL,
  display_icon_hash      TEXT,
  is_hostile             INTEGER,
  tooltip_source         TEXT,
  tooltip_rich_text_json TEXT
);
`;

interface StatusEffectRow {
  id: string;
  status_effect_name: string | null;
  tooltip_source: string | null;
  icon_ref_json: string | null;
  display_icon_hash: string | null;
  is_hostile: number | null;
}

export function emitStatusEffectReadModels(
  db: Database,
  routeBase = "/status-effects",
  masterTooltip?: MasterTooltipVocabulary,
): PipelineDiagnostic[] {
  db.exec(STATUS_EFFECT_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO status_effect_overview_rows (
       id, name, is_hostile
     ) VALUES (?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO status_effect_presentation_rows (
       id, name, render_context, display_icon_hash, is_hostile,
       tooltip_source, tooltip_rich_text_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<StatusEffectRow, []>(
      `SELECT s.id, s.status_effect_name, s.tooltip_source,
              s.icon_ref_json, s.is_hostile,
              icon.asset_hash AS display_icon_hash
       FROM status_effects s
       LEFT JOIN asset_refs icon
         ON icon.entity_id = 'status-effect'
        AND icon.entity_row_id = s.id
        AND icon.slot = 'iconRef'
        AND icon.asset_kind = 'image'
       ORDER BY COALESCE(NULLIF(TRIM(s.status_effect_name), ''), 'Unnamed status effect'), s.id`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of rows) {
      const presentationName = row.status_effect_name?.trim() || "Unnamed status effect";
      if (hasAuthoredIconReference(row.icon_ref_json) && row.display_icon_hash === null) {
        diagnostics.push({
          severity: "diagnostic",
          source: "status-effect-read-model",
          code: "statusEffectIconUnresolved",
          message: `Status effect '${row.id}' has an unresolvable icon reference.`,
          entityType: "status-effect",
          entityId: row.id,
          field: "status_effects.icon_ref_json",
          evidence: { iconRef: row.icon_ref_json },
        });
      }
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
      overviewInsert.run(row.id, presentationName, row.is_hostile);
      presentationInsert.run(
        row.id,
        presentationName,
        "status-effect-presentation-v1",
        row.display_icon_hash,
        row.is_hostile,
        row.tooltip_source,
        tooltip === null ? null : JSON.stringify(tooltip),
      );

      const slug = deriveEntityNodeSlug(presentationName, row.id);
      writeNode({
        entityType: "status-effect",
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
          entityType: "status-effect",
          entityId: row.id,
          field: diagnostic.field,
        });
      }
    }
  });
  tx();
  return diagnostics;
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
