import { describe, expect, it } from "bun:test";
import { resolveItemDisplayLabel } from "../src/entities/item/read-models.ts";

describe("item display labels", () => {
  it("uses a variant-specific placeholder for missing names", () => {
    const result = resolveItemDisplayLabel(null, null, "Melee weapon");

    expect(result).toEqual({ label: "Unnamed item — Melee weapon", isPlaceholder: true });
    expect(result.label).not.toBe("");
    expect(result.label).not.toContain("named;");
  });

  it("recognises all prototype name forms", () => {
    for (const name of ["BASE ring", "placeholder potion", "Scroll of {lvl} {name}"]) {
      expect(resolveItemDisplayLabel(name, null, "Consumable")).toEqual({
        label: "Unnamed item — Consumable",
        isPlaceholder: true,
      });
    }
  });

  it("uses the canonical name when it exists", () => {
    expect(resolveItemDisplayLabel("Iron Sword", null, "Melee weapon")).toEqual({
      label: "Iron Sword",
      isPlaceholder: false,
    });
  });
});
