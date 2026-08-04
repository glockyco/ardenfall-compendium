import { describe, expect, it } from "bun:test";
import { itemNameForDisplay, itemNameForList } from "../src/lib/components/items/itemName";

describe("item display names", () => {
  it("uses the unnamed item label for game format strings", () => {
    expect(itemNameForDisplay("Recipe of {0}")).toBe("Unnamed item");
    expect(itemNameForDisplay("Potion of {lvl} {name}")).toBe("Unnamed item");
    expect(itemNameForDisplay("BASE Helmet")).toBe("Unnamed item");
  });

  it("keeps the authored variant label without exposing a short id", () => {
    const row = {
      name: "Recipe of {0}",
      variantLabel: "Melee Weapon",
    };
    const label = itemNameForList(row, {});
    expect(label).toBe("Unnamed item — Melee Weapon");
  });

  it("uses the unnamed item label for a blank name", () => {
    expect(itemNameForList({ name: "  ", variantLabel: "Melee Weapon" }, {})).toBe(
      "Unnamed item — Melee Weapon",
    );
  });

  it("adds the authored variant label for repeated names without an identifier", () => {
    const duplicateNames = { Sword: 2 };
    const label = itemNameForList({ name: "Sword", variantLabel: "Melee Weapon" }, duplicateNames);
    expect(label).toBe("Sword — Melee Weapon");
  });
});
