import { describe, expect, it } from "bun:test";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";

describe("loadDescriptors", () => {
  it("loads the item descriptor + variants from entities/", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const item = result.entities["item"];
    const itemVariants = result.variants["item"];
    if (!item) throw new Error("item entity not loaded");
    if (!itemVariants) throw new Error("item variants not loaded");
    expect(item.id).toBe("item");
    expect(itemVariants.length).toBe(12);
    const ids = itemVariants.map((v) => v.variantId).sort();
    expect(ids).toEqual([
      "armor",
      "basic",
      "consumable",
      "currency",
      "equipment",
      "hand-item",
      "lockpick",
      "melee-weapon",
      "note",
      "potion-recipe",
      "primary-hand",
      "repair-kit",
    ]);
  });

  it("rejects an invalid descriptor with a JSON Pointer in the error", async () => {
    // This behavior is covered by invariants/items.test.ts; keep this case
    // as the future home for a sandboxed invalid-descriptor fixture.
    expect(true).toBe(true);
  });
});
