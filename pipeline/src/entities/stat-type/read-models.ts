import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import type { MasterTooltipVocabulary } from "../../types.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../item/read-models.ts";

export const STAT_TYPE_READ_MODEL_DDL = `
CREATE TABLE stat_type_overview_rows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  grouping    TEXT NOT NULL,
  icon_hash   TEXT,
  icon_color  TEXT
);
CREATE TABLE stat_type_presentation_rows (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  grouping             TEXT NOT NULL,
  render_context       TEXT NOT NULL,
  icon_hash            TEXT,
  icon_color           TEXT,
  description          TEXT,
  long_description     TEXT,
  affects_json         TEXT NOT NULL DEFAULT '[]',
  skill_affects_json   TEXT NOT NULL DEFAULT '[]'
);
`;

export function emitStatTypeReadModels(
  db: Database,
  masterTooltip?: MasterTooltipVocabulary,
  routeBase = "/stats",
): PipelineDiagnostic[] {
  db.exec(STAT_TYPE_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO stat_type_overview_rows (id, name, grouping, icon_hash, icon_color) VALUES (?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO stat_type_presentation_rows (
      id, name, grouping, render_context, icon_hash, icon_color,
      description, long_description, affects_json, skill_affects_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const rows = db
    .query<
      {
        id: string;
        is_attribute: number;
        stat_name: string | null;
        icon_hash: string | null;
        icon_color_json: string | null;
        stat_description: string | null;
        long_stat_description: string | null;
        affects_json: string;
        skill_affects_json: string;
      },
      []
    >(
      `SELECT s.id, s.is_attribute, s.stat_name, ar.asset_hash AS icon_hash,
              s.icon_color_json, s.stat_description, s.long_stat_description,
              s.affects_json, s.skill_affects_json
       FROM stat_types s
       LEFT JOIN asset_refs ar
         ON ar.entity_id = 'stat-type'
        AND ar.entity_row_id = s.id
        AND ar.slot = 'iconRef'
        AND ar.asset_kind = 'image'
       ORDER BY s.stat_name`,
    )
    .all();

  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    const statNodes = new Map<string, string>();
    for (const stat of rows) {
      const statName = stat.stat_name?.trim();
      if (!statName) continue;
      const slug = deriveEntityNodeSlug(statName, stat.id);
      statNodes.set(statName.toLowerCase(), `${routeBase}/${slug.canonicalSlug}`);
    }
    const resolveReferences = (referencesJson: string, sourceId: string) =>
      JSON.stringify(
        (JSON.parse(referencesJson) as unknown[]).map((reference) => {
          if (typeof reference !== "string") {
            throw new Error(`invalid stat reference JSON for '${sourceId}'`);
          }
          const label = reference.trim();
          return { label, routePath: statNodes.get(label.toLowerCase()) ?? null };
        }),
      );

    for (const row of rows) {
      const label = row.stat_name?.trim() || "Unnamed stat";
      // A StatType is an attribute or a skill. The asset says which. Traits are a
      // separate asset type entirely, so they cannot classify a stat.
      const grouping = row.is_attribute === 1 ? "attribute" : "skill";
      if (masterTooltip && row.stat_name) {
        const vocabularyKey = snakeCaseStatName(row.stat_name);
        const vocabularyName = grouping === "attribute" ? "allAttributes" : "allSkills";
        const vocabulary = masterTooltip[vocabularyName];
        if (!vocabulary.includes(vocabularyKey)) {
          diagnostics.push({
            severity: "diagnostic",
            source: "stat-type-read-model",
            code: "statVocabularyMissing",
            message: `Stat '${row.stat_name}' is missing from master tooltip ${vocabularyName}.`,
            entityType: "stat-type",
            entityId: row.id,
            field: "statName",
            evidence: { statName: row.stat_name, vocabularyKey, vocabularyName },
          });
        }
      }
      overviewInsert.run(row.id, label, grouping, row.icon_hash, row.icon_color_json);
      presentationInsert.run(
        row.id,
        label,
        grouping,
        "stat-type-presentation-v1",
        row.icon_hash,
        row.icon_color_json,
        row.stat_description,
        row.long_stat_description,
        resolveReferences(row.affects_json, row.id),
        resolveReferences(row.skill_affects_json, row.id),
      );
      const slug = deriveEntityNodeSlug(label, row.id);
      writeNode({
        entityType: "stat-type",
        entityId: row.id,
        label,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
  return diagnostics;
}

function snakeCaseStatName(statName: string): string {
  return statName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
