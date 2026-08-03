import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope, SpellSnapshotFields } from "../../types.ts";
import { entityRows } from "../../types.ts";

function jsonOrNull(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export function canonicaliseSpells(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO spells (
       id, spell_name, stat_type_ref_json, mana_cost, is_illegal, tooltip_source, icon_ref_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const effectInsert = db.prepare(
    `INSERT INTO spell_effects (
       id, spell_id, effect_ordinal, kind, status_effect_ref_json,
       level, lifetime, applies_to_self, damage, damage_type
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<SpellSnapshotFields>(envelope)) {
      const fields = row.fields;
      insert.run(
        row.id,
        fields.spellName ?? null,
        fields.statTypeRef ? JSON.stringify(fields.statTypeRef) : null,
        fields.manaCost ?? null,
        fields.isIllegal === undefined || fields.isIllegal === null
          ? null
          : fields.isIllegal
            ? 1
            : 0,
        fields.tooltipSource?.trim() ? fields.tooltipSource : null,
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
      );
      for (const [effectOrdinal, effect] of (fields.spellEffects ?? []).entries()) {
        effectInsert.run(
          `${row.id}:effect:${effectOrdinal}`,
          row.id,
          effectOrdinal,
          effect.kind,
          jsonOrNull(effect.statusEffectRef),
          effect.sampleLevel ?? null,
          effect.sampleLifetimeSeconds ?? null,
          effect.appliesToSelf === undefined || effect.appliesToSelf === null
            ? null
            : effect.appliesToSelf
              ? 1
              : 0,
          effect.damage ?? null,
          effect.damageType ?? null,
        );
      }
    }
  });
  tx();
}
