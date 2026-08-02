import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope, StatusEffectSnapshotFields } from "../../types.ts";
import { entityRows } from "../../types.ts";

export function canonicaliseStatusEffects(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO status_effects (
       id, status_effect_name, tooltip_source, icon_ref_json, is_hostile
     ) VALUES (?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<StatusEffectSnapshotFields>(envelope)) {
      const fields = row.fields;
      insert.run(
        row.id,
        fields.statusEffectName ?? null,
        fields.tooltipSource?.trim() ? fields.tooltipSource : null,
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
        fields.isHostile === undefined || fields.isHostile === null
          ? null
          : fields.isHostile
            ? 1
            : 0,
      );
    }
  });
  tx();
}
