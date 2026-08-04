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
    // The marker appears wherever the author put it. Anchoring to the start of the
    // name missed eleven prototypes whose marker is a suffix or sits mid-name.
    for (const name of [
      "BASE ring",
      "placeholder potion",
      "Scroll of {lvl} {name}",
      "Blunt BASE",
      "Longbow base",
      "Auto Base",
      "Ingredient BASE",
    ]) {
      expect(resolveItemDisplayLabel(name, null, "Consumable")).toEqual({
        label: "Unnamed item — Consumable",
        isPlaceholder: true,
      });
    }
  });

  it("keeps a real name that merely contains the marker as a word part", () => {
    // The rule matches the standalone word, so a name that only embeds those letters
    // is untouched. Without the word boundary these would lose their pages.
    for (const name of ["Alabaster Ring", "Baseborn Cloak", "Debased Coin"]) {
      expect(resolveItemDisplayLabel(name, null, "Consumable")).toEqual({
        label: name,
        isPlaceholder: false,
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
