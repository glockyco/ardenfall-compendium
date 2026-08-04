import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(import.meta.dir, relativePath), "utf8");
const itemHeaderSource = source("../src/lib/components/items/ItemHeader.svelte");
const characterDetailSource = source("../src/lib/components/characters/CharacterDetail.svelte");
const characterRouteSource = source("../src/routes/characters/[slug]/+page.svelte");
const enchantmentDetailSource = source(
  "../src/lib/components/enchantments/EnchantmentDetail.svelte",
);
const enchantmentRouteSource = source("../src/routes/enchantments/[slug]/+page.svelte");
const recipeDetailSource = source("../src/lib/components/potion-recipes/PotionRecipeDetail.svelte");
const recipeRouteSource = source("../src/routes/potion-recipes/[slug]/+page.svelte");

const occurrences = (value: string, needle: string): number => value.split(needle).length - 1;

describe("stored item labels", () => {
  it("renders the stored placeholder label and its data-driven explanation", () => {
    expect(itemHeaderSource).toContain('<h1 class="text-2xl font-bold">{item.name}</h1>');
    expect(itemHeaderSource).toContain("{#if item.nameIsPlaceholder}");
    expect(itemHeaderSource).toContain(
      "The game builds this name while you play, so the compendium cannot show one.",
    );
    expect(itemHeaderSource).not.toContain("itemNameForDisplay");
    expect(itemHeaderSource).not.toContain("isPlaceholderItemName");
  });

  it("removes the duplicated character and enchantment lists", () => {
    expect(characterDetailSource).not.toContain(">Drops</h2>");
    expect(occurrences(characterRouteSource, "<RelationshipSection {section} />")).toBe(1);
    expect(enchantmentDetailSource).not.toContain(">Can enchant</h2>");
    expect(occurrences(enchantmentRouteSource, "<RelationshipSection {section} />")).toBe(1);
  });

  it("renders game tooltip prose without internal effect names", () => {
    expect(enchantmentDetailSource).toContain("<RichText richText={enchantment.description} />");
    expect(enchantmentDetailSource).toContain("<RichText richText={effect.description} />");
    expect(enchantmentDetailSource).not.toContain("EnchantmentEffect");
    // The literal above only catches the wording that shipped. The invariant is that the
    // effect's kind never reaches the template at all, because the kind is a C# type name
    // and interpolating it would leak one under any wording.
    expect(enchantmentDetailSource).not.toContain("effect.kind");
    expect(enchantmentDetailSource).not.toContain("is present, but");
  });

  it("keeps each recipe panel while the route owns relationship rendering", () => {
    expect(occurrences(recipeDetailSource, ">Produces</h2>")).toBe(1);
    expect(occurrences(recipeDetailSource, ">Ingredients</h2>")).toBe(1);
    expect(occurrences(recipeRouteSource, "<RelationshipSection {section} />")).toBe(1);
  });

  it("has no remaining item naming helper", () => {
    expect(existsSync(join(import.meta.dir, "../src/lib/components/items/itemName.ts"))).toBe(
      false,
    );
  });
});
