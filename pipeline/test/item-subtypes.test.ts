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
});
