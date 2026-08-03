import { describe, expect, it } from "bun:test";
import { itemNameForDisplay, itemNameForList } from "../src/lib/components/items/itemName";

describe("item display names", () => {
  it("replaces game format strings with the unavailable label", () => {
    expect(itemNameForDisplay("Recipe of {0}")).toBe("Name unavailable");
    expect(itemNameForDisplay("Potion of {lvl} {name}")).toBe("Name unavailable");
  });

  it("adds a reader-facing variant label and short id when needed", () => {
    const row = {
      name: "Recipe of {0}",
      variantLabel: "Melee Weapon",
      shortId: "abc12345",
    };
    expect(itemNameForList(row, {})).toBe("Name unavailable — Melee Weapon · abc12345");
  });

  it("adds a reader-facing variant label and short id when a name is missing", () => {
    expect(
      itemNameForList({ name: null, variantLabel: "Melee Weapon", shortId: "abc12345" }, {}),
    ).toBe("Name unavailable — Melee Weapon · abc12345");
  });

  const duplicateNames = { Sword: 2 };
  expect(
    itemNameForList(
      { name: "Sword", variantLabel: "Melee Weapon", shortId: "abc12345" },
      duplicateNames,
    ),
  ).toBe("Sword — Melee Weapon · abc12345");
});
