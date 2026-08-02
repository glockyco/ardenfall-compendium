import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope, SpellSnapshotFields } from "../../types.ts";
import { entityRows } from "../../types.ts";

export function canonicaliseSpells(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO spells (
       id, spell_name, stat_type_ref_json, mana_cost, is_illegal, icon_ref_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
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
        fields.iconRef ? JSON.stringify(fields.iconRef) : null,
      );
    }
  });
  tx();
}
