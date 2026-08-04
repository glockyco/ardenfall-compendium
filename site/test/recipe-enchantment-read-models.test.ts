import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seed = () => {
  const root = mkdtempSync(join(tmpdir(), "ardenfall-site-recipe-enchantment-models-"));
  mkdirSync(join(root, ".data"), { recursive: true });
  const db = new Database(join(root, ".data", "data.sqlite"));
  db.exec(`
    CREATE TABLE potion_recipe_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      locked_by_default INTEGER NOT NULL,
      enable_skill_requirement INTEGER NOT NULL,
      skill_requirement INTEGER NOT NULL
    );
    CREATE TABLE potion_recipe_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      render_context TEXT NOT NULL,
      locked_by_default INTEGER NOT NULL,
      skill_requirement INTEGER,
      level_modifier REAL NOT NULL,
      success_modifier REAL NOT NULL,
      ingredients_json TEXT NOT NULL,
      products_json TEXT NOT NULL
    );
    CREATE TABLE enchantment_overview_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      money_value REAL NOT NULL,
      hide_effect_tooltips INTEGER NOT NULL
    );
    CREATE TABLE enchantment_presentation_rows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      render_context TEXT NOT NULL,
      money_value REAL NOT NULL,
      hide_effect_tooltips INTEGER NOT NULL,
      items_json TEXT NOT NULL,
      effects_json TEXT NOT NULL
    );
    CREATE TABLE entity_nodes (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      display_label TEXT NOT NULL,
      route_path TEXT NOT NULL,
      canonical_slug TEXT NOT NULL,
      short_id TEXT NOT NULL,
      has_page INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id)
    );
    INSERT INTO potion_recipe_overview_rows VALUES
      ('recipe-both', 'Raw recipe label', 1, 1, 5),
      ('recipe-empty', 'Another raw label', 0, 0, 0);
    INSERT INTO potion_recipe_presentation_rows VALUES
      ('recipe-both', 'Raw recipe label', 'potion-recipe-presentation-v1', 1, 5, 1.1, 0.25,
       '[{"tagId":"tag-poison","tagLabel":"Poisonous","tagRoutePath":"/tags/poisonous--tag00001","count":2}]',
       '[{"itemId":"item-drink","itemLabel":"Levitation I","itemRoutePath":"/items/levitation-i--item0001","form":"drinkable"},{"itemId":"item-throw","itemLabel":"Levitation Flask","itemRoutePath":null,"form":"throwing"}]');
    INSERT INTO potion_recipe_presentation_rows VALUES
      ('recipe-empty', 'Another raw label', 'potion-recipe-presentation-v1', 0, NULL, 0, 0, '[]', '[]');
    INSERT INTO enchantment_overview_rows VALUES
      ('enchant-status', 'Raw enchantment label', 20, 0),
      ('enchant-any', 'Any item raw label', 0, 0);
    INSERT INTO enchantment_presentation_rows VALUES
      ('enchant-status', 'Raw enchantment label', 'enchantment-presentation-v1', 20, 0,
       '[{"itemId":"item-sword","itemLabel":"Iron Sword","itemRoutePath":"/items/iron-sword--item0001"}]',
       '[{"ordinal":0,"kind":"StatusEffectEnchantmentEffect","statusEffectId":"status-burning","statusEffectLabel":"Burning","statusEffectRoutePath":"/status-effects/burning--effect0001"},{"ordinal":1,"kind":"MeleeParticleEchantmentEffect","statusEffectId":null,"statusEffectLabel":null,"statusEffectRoutePath":null}]');
    INSERT INTO enchantment_presentation_rows VALUES
      ('enchant-any', 'Any item raw label', 'enchantment-presentation-v1', 0, 0, '[]', '[]');
    INSERT INTO entity_nodes VALUES
      ('potion-recipe','recipe-both','Raw recipe label','Recipe with products','/potion-recipes/recipe-with-products--rec00001','recipe-with-products--rec00001','rec00001',1),
      ('potion-recipe','recipe-empty','Another raw label','Recipe without ingredients','/potion-recipes/recipe-without-ingredients--rec00002','recipe-without-ingredients--rec00002','rec00002',1),
      ('enchantment','enchant-status','Raw enchantment label','Status enchantment','/enchantments/status-enchantment--enc00001','status-enchantment--enc00001','enc00001',1),
      ('enchantment','enchant-any','Any item raw label','Unrestricted enchantment','/enchantments/unrestricted-enchantment--enc00002','unrestricted-enchantment--enc00002','enc00002',1);
  `);
  db.close();
  return root;
};

describe("recipe and enchantment read-model accessors", () => {
  it("publishes products in both forms and names recipes from entity nodes", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.listPotionRecipes()[0]?.name).toBe("Recipe with products");
      expect(
        readModels.getPotionRecipePresentation("recipe-with-products--rec00001"),
      ).toMatchObject({
        name: "Recipe with products",
        skillRequirement: 5,
        producedRefs: [
          { itemId: "item-drink", form: "drinkable" },
          { itemId: "item-throw", form: "throwing" },
        ],
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("states when a recipe has no ingredients and omits its disabled requirement", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(
        readModels.getPotionRecipePresentation("recipe-without-ingredients--rec00002"),
      ).toMatchObject({
        ingredients: [],
        skillRequirement: null,
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes status effects and unextracted enchantment effect kinds", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(readModels.getEnchantmentPresentation("status-enchantment--enc00001")).toMatchObject({
        name: "Status enchantment",
        appliesToItemRefs: [{ itemId: "item-sword" }],
        effects: [
          { kind: "StatusEffectEnchantmentEffect", statusEffectLabel: "Burning" },
          { kind: "MeleeParticleEchantmentEffect", statusEffectId: null },
        ],
      });
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("represents an enchantment with no applicable item filter as an empty list", async () => {
    const originalCwd = process.cwd();
    const root = seed();
    try {
      process.chdir(root);
      const readModels = await import("../src/lib/server/read-models");
      expect(
        readModels.getEnchantmentPresentation("unrestricted-enchantment--enc00002")
          ?.appliesToItemRefs,
      ).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
