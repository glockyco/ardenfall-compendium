import type { Database } from "bun:sqlite";
import type { EnchantmentSnapshotFields, SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows } from "../../types.ts";

function refJson(ref: SnapshotRef): string {
  return JSON.stringify(ref);
}

export function canonicaliseEnchantments(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO enchantments (
       id, enchantment_name, money_value, hide_effect_tooltips, tooltip_source
     ) VALUES (?, ?, ?, ?, ?)`,
  );
  const itemInsert = db.prepare(
    `INSERT INTO enchantment_items (
       id, enchantment_id, item_ordinal, item_ref_json
     ) VALUES (?, ?, ?, ?)`,
  );
  const effectInsert = db.prepare(
    `INSERT INTO enchantment_effects (
       id, enchantment_id, effect_ordinal, kind, status_effect_ref_json, tooltip_source
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<EnchantmentSnapshotFields>(envelope)) {
      const fields = row.fields;
      insert.run(
        row.id,
        fields.enchantmentName ?? null,
        fields.moneyValue ?? null,
        fields.hideEffectTooltips === undefined || fields.hideEffectTooltips === null
          ? null
          : fields.hideEffectTooltips
            ? 1
            : 0,
        fields.tooltipSource?.trim() ? fields.tooltipSource : null,
      );
      for (const [ordinal, ref] of (fields.appliesToItemRefs ?? []).entries()) {
        itemInsert.run(`${row.id}:item:${ordinal}`, row.id, ordinal, refJson(ref));
      }
      for (const effect of fields.effects ?? []) {
        effectInsert.run(
          `${row.id}:effect:${effect.ordinal}`,
          row.id,
          effect.ordinal,
          effect.kind,
          effect.statusEffectRef ? refJson(effect.statusEffectRef) : null,
          effect.tooltipSource?.trim() ? effect.tooltipSource : null,
        );
      }
    }
  });
  tx();
}
