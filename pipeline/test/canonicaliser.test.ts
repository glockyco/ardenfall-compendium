import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseItems } from "$pipeline/entities/item/canonicaliser";
import { buildDDL } from "$pipeline/sql/ddl";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { loadSnapshot } from "$pipeline/stages/load-snapshot";

const ctx = {
  workspaceRoot: ".",
  snapshotDir: "fixtures/synthetic/snapshot",
  outDir: "pipeline/test/.tmp",
  log: () => undefined,
};

describe("canonicaliseItems", () => {
  it("inserts a row in items + each ancestor variant table", async () => {
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

    const items = db.query("SELECT id, name, variant FROM items ORDER BY id").all() as {
      id: string;
      name: string;
      variant: string;
    }[];
    expect(items.length).toBe(5);
    expect(items.find((r) => r.id === "fixture-iron-sword")?.variant).toBe("melee-weapon");

    const equipRows = db.query("SELECT id, equipSlot FROM item_equipment").all() as {
      id: string;
    }[];
    expect(equipRows.length).toBe(4); // all equipment variants except the consumable fixture

    const meleeRows = db.query("SELECT id, damage FROM item_melee_weapons").all() as {
      id: string;
      damage: number;
    }[];
    expect(meleeRows.find((r) => r.id === "fixture-iron-sword")?.damage).toBe(7.5);

    const armorRows = db.query("SELECT id FROM item_armor").all() as { id: string }[];
    expect(armorRows.find((r) => r.id === "fixture-leather-tunic")).toBeDefined();

    const consumableRows = db
      .query("SELECT id, quickslotCooldownTime FROM item_consumables")
      .all() as {
      id: string;
      quickslotCooldownTime: number;
    }[];
    expect(
      consumableRows.find((r) => r.id === "fixture-stamina-draught")?.quickslotCooldownTime,
    ).toBe(12.5);

    const tagRows = db
      .query("SELECT item_id, tag FROM item_tag_refs ORDER BY item_id, tag")
      .all() as {
      item_id: string;
      tag: string;
    }[];
    expect(tagRows.length).toBe(10); // 5 rows * 2 tags
  });
});
