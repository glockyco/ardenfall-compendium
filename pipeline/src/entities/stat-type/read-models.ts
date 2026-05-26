import type { Database } from "bun:sqlite";
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
): void {
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
  const skillIds = new Set(masterTooltip?.allSkills ?? []);
  const rows = db
    .query<
      {
        id: string;
        is_attribute: number;
        stat_name: string;
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

  const tx = db.transaction(() => {
    for (const row of rows) {
      const grouping =
        row.is_attribute === 1 ? "attribute" : skillIds.has(row.id) ? "skill" : "trait";
      overviewInsert.run(row.id, row.stat_name, grouping, row.icon_hash, row.icon_color_json);
      presentationInsert.run(
        row.id,
        row.stat_name,
        grouping,
        "stat-type-presentation-v1",
        row.icon_hash,
        row.icon_color_json,
        row.stat_description,
        row.long_stat_description,
        row.affects_json,
        row.skill_affects_json,
      );
      const slug = deriveEntityNodeSlug(row.stat_name, row.id);
      writeNode({
        entityType: "stat-type",
        entityId: row.id,
        label: row.stat_name,
        routePath: `/stats/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
    }
  });
  tx();
}
