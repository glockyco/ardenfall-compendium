import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { buildDDL } from "$pipeline/sql/ddl";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { emitItemReadModels } from "$pipeline/stages/emit-read-models";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";

const ctx = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: ".",
  log: () => undefined,
};

describe("emitItemReadModels", () => {
  it("builds item_overview_rows and item_detail_rows", async () => {
    const desc = await loadDescriptors.run({}, ctx);
    const snap = await loadSnapshot.run({}, ctx);
    const itemEntity = desc.entities.item;
    const itemVariants = desc.variants.item;
    const itemEnvelope = snap.envelopes.item;
    if (!itemEntity || !itemVariants || !itemEnvelope) {
      throw new Error("fixture missing item entity/variants/envelope");
    }
    const db = new Database(":memory:");
    db.exec(buildDDL(itemEntity, itemVariants));
    canonicaliseItems(db, itemEntity, itemVariants, itemEnvelope);
    emitItemReadModels(db, desc);

    const overview = db
      .query("SELECT id, name, variant FROM item_overview_rows ORDER BY name")
      .all() as { id: string; name: string; variant: string }[];
    expect(overview.map((r) => r.name)).toEqual([
      "Fire Flask",
      "Iron Sword",
      "Leather Tunic",
      "Spark Slate",
      "Stamina Draught",
    ]);

    const detail = db
      .query("SELECT id, fields_json FROM item_detail_rows WHERE id = 'fixture-iron-sword'")
      .get() as { id: string; fields_json: string };
    const fields = JSON.parse(detail.fields_json) as Record<string, unknown>;
    expect(fields.damage).toBe(7.5);
    expect(fields.weight).toBe(3.5);
    const consumableDetail = db
      .query("SELECT id, fields_json FROM item_detail_rows WHERE id = 'fixture-stamina-draught'")
      .get() as { id: string; fields_json: string };
    const consumableFields = JSON.parse(consumableDetail.fields_json) as Record<string, unknown>;
    expect(consumableFields.quickslotCooldownTime).toBe(12.5);
    expect(consumableFields.iconRef).toEqual({
      kind: "missing",
      reason: "lookupAssetGuidMissing",
      source: "ItemData.icon",
    });
    expect(consumableFields.statusEffectsJson).toEqual([
      {
        statusEffectRef: null,
        level: 1,
        lifetime: 30,
        stackMode: { type: "Refresh", addLevel: 0, maxLevel: 0 },
      },
    ]);
  });
});
