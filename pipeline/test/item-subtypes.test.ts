import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { buildDDL } from "$pipeline/sql/ddl";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

describe("item subtype descriptors", () => {
  test("loads zero-field marker variants", async () => {
    const loaded = await loadDescriptors.run({}, ctx);
    const variants = loaded.variants.item ?? [];

    expect(variants.find((variant) => variant.variantId === "basic")?.fields).toEqual([]);
    expect(variants.find((variant) => variant.variantId === "currency")?.fields).toEqual([]);
  });

  test("creates canonical tables for marker variants", async () => {
    const loaded = await loadDescriptors.run({}, ctx);
    const db = new Database(":memory:");
    const itemEntity = loaded.entities.item;
    const itemVariants = loaded.variants.item ?? [];
    if (!itemEntity) throw new Error("item descriptor missing");

    db.exec(buildDDL(itemEntity, itemVariants));

    expect(
      db.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'item_basic'").get(),
    ).toBeTruthy();
    expect(
      db
        .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'item_currency'")
        .get(),
    ).toBeTruthy();
  });

  test("describes every non-equipment subtype found in live diagnostics", async () => {
    const loaded = await loadDescriptors.run({}, ctx);
    const variantIds = (loaded.variants.item ?? []).map((variant) => variant.variantId);

    expect(variantIds).toEqual(
      expect.arrayContaining([
        "basic",
        "currency",
        "lockpick",
        "consumable",
        "note",
        "potion-recipe",
        "repair-kit",
      ]),
    );
  });

  test("describes equipment leaf subtypes before ancestor fallbacks", async () => {
    const loaded = await loadDescriptors.run({}, ctx);
    const variants = loaded.variants.item ?? [];
    const byId = new Map(variants.map((variant) => [variant.variantId, variant]));

    expect(byId.get("arrow")?.parentVariantId).toBe("equipment");
    expect(byId.get("bow")?.parentVariantId).toBe("primary-hand");
    expect(byId.get("slate-spell")?.parentVariantId).toBe("primary-hand");
    expect(byId.get("throwing-item")?.parentVariantId).toBe("primary-hand");
    expect(byId.get("throwing-potion")?.parentVariantId).toBe("throwing-item");

    const throwingPotionFields = new Map(
      (byId.get("throwing-potion")?.fields ?? []).map((field) => [field.name, field]),
    );
    expect(throwingPotionFields.get("visualLevel")?.type).toBe("number");
    expect(throwingPotionFields.get("effectName")?.missingPolicy).toBe("optional-empty");
    expect(throwingPotionFields.get("quickslotSecondaryColorJson")?.type).toBe("json");
  });
});
