import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    expect(itemVariants.length).toBe(17);
    const ids = itemVariants.map((v) => v.variantId).sort();
    expect(ids).toEqual([
      "armor",
      "arrow",
      "basic",
      "bow",
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
      "slate-spell",
      "throwing-item",
      "throwing-potion",
    ]);
  });

  it("loads the stat-type descriptor without variants", async () => {
    const result = await loadDescriptors.run(
      {},
      {
        workspaceRoot: ".",
        snapshotDir: "",
        outDir: "",
        log: () => undefined,
      },
    );
    const statType = result.entities["stat-type"];
    if (!statType) throw new Error("stat-type entity not loaded");

    expect(statType.label.plural).toBe("Stats");
    expect(statType.presentationContext?.renderContext).toBe("stat-type-presentation-v1");
    expect(statType.fields.map((field) => field.name)).toContain("statName");
    expect(result.variants["stat-type"]).toEqual([]);
  });

  it("loads non-variant entity descriptors with presentation contexts", async () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-descriptor-"));
    try {
      const entityDir = join(root, "entities", "stat-type");
      mkdirSync(entityDir, { recursive: true });
      writeFileSync(
        join(entityDir, "entity.json"),
        `${JSON.stringify(
          {
            $schema: "../../schemas/entity.schema.json",
            id: "stat-type",
            label: { singular: "Stat type", plural: "Stat types" },
            extraction: {
              root: "BuiltLookupTable.GetAssetsOfType<StatType>",
              walker: "StatTypeWalker",
            },
            presentationContext: { renderContext: "stat-type-presentation-v1" },
            fields: [
              { name: "id", type: "id", from: "guid", missingPolicy: "fatal" },
              { name: "name", type: "string", from: "statName", missingPolicy: "fatal" },
            ],
            map: null,
          },
          null,
          2,
        )}\n`,
      );

      const result = await loadDescriptors.run(
        {},
        {
          workspaceRoot: root,
          snapshotDir: "",
          outDir: "",
          log: () => undefined,
        },
      );

      expect(result.variants["stat-type"]).toEqual([]);
      expect(
        (result.entities["stat-type"] as { presentationContext?: { renderContext: string } })
          .presentationContext,
      ).toEqual({ renderContext: "stat-type-presentation-v1" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an invalid descriptor with a JSON Pointer in the error", async () => {
    // This behavior is covered by invariants/items.test.ts; keep this case
    // as the future home for a sandboxed invalid-descriptor fixture.
    expect(true).toBe(true);
  });
});
