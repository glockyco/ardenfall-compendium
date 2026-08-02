import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope } from "../../types.ts";
import { entityRows } from "../../types.ts";

export interface StatTypeFields {
  id: string;
  isAttribute: boolean;
  statName: string;
  iconRef?: unknown;
  iconColor?: unknown;
  statDescription?: string | null;
  longStatDescription?: string | null;
  affects?: string[];
  skillAffects?: string[];
}

export function canonicaliseStatTypes(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO stat_types (
       id, is_attribute, stat_name, icon_ref_json, icon_color_json,
       stat_description, long_stat_description, affects_json, skill_affects_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<StatTypeFields>(envelope)) {
      const fields = row.fields;
      insert.run(
        row.id,
        fields.isAttribute ? 1 : 0,
        fields.statName,
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
        fields.iconColor ? JSON.stringify(fields.iconColor) : null,
        fields.statDescription ?? null,
        fields.longStatDescription ?? null,
        JSON.stringify(fields.affects ?? []),
        JSON.stringify(fields.skillAffects ?? []),
      );
    }
  });
  tx();
}
