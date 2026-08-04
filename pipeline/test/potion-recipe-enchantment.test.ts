import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { canonicalisePotionRecipes } from "../src/entities/potion-recipe/canonicaliser.ts";
import { emitPotionRecipeReadModels } from "../src/entities/potion-recipe/read-models.ts";
import { canonicaliseEnchantments } from "../src/entities/enchantment/canonicaliser.ts";
import { emitEnchantmentReadModels } from "../src/entities/enchantment/read-models.ts";
import { ENTITY_GRAPH_DDL } from "../src/relationships/relationship-graph.ts";
import { relationshipRegistry } from "../src/relationships/registry.ts";
import { POTION_RECIPE_DDL } from "../src/sql/potion-recipe-ddl.ts";
import { ENCHANTMENT_DDL } from "../src/sql/enchantment-ddl.ts";

describe("potion recipes and enchantments", () => {
  it("preserves ingredient and product order and uses item-tag ingredients", () => {
    const db = new Database(":memory:");
    db.exec(POTION_RECIPE_DDL);
    db.exec(ENTITY_GRAPH_DDL);
    seedNode(db, "item-tag", "f60718293a4b5c6d7e8f90a1b2c3d4e5.11400000", "Tag A", "/tags/tag-a");
    seedNode(db, "item-tag", "0718293a4b5c6d7e8f90a1b2c3d4e5f6.11400000", "Tag B", "/tags/tag-b");
    seedNode(db, "item", "c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000", "Drink", "/items/item-a");
    seedNode(db, "item", "d4e5f60718293a4b5c6d7e8f90a1b2c3.11400000", "Throw", "/items/item-b");
    seedNode(
      db,
      "status-effect",
      "e5f60718293a4b5c6d7e8f90a1b2c3d4.11400000",
      "Burning",
      "/status-effects/burning",
    );
    canonicalisePotionRecipes(db, {
      entityId: "potion-recipe",
      schemaVersion: 1,
      rows: [
        {
          id: "638932f242126f24a801724271ae6714.11400000",
          fields: {
            id: "638932f242126f24a801724271ae6714.11400000",
            statusEffectRef: {
              kind: "lookupAsset",
              guid: "e5f60718293a4b5c6d7e8f90a1b2c3d4.11400000",
            },
            lockedByDefault: false,
            enableSkillRequirement: false,
            skillRequirement: 0,
            levelModifier: 0,
            successModifier: 0,
            ingredients: [
              {
                tagRef: { kind: "lookupAsset", guid: "0718293a4b5c6d7e8f90a1b2c3d4e5f6.11400000" },
                count: 2,
              },
              {
                tagRef: { kind: "lookupAsset", guid: "f60718293a4b5c6d7e8f90a1b2c3d4e5.11400000" },
                count: 1,
              },
            ],
            producedRefs: [
              {
                ref: { kind: "lookupAsset", guid: "c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000" },
                form: "drinkable",
              },
              {
                ref: { kind: "lookupAsset", guid: "d4e5f60718293a4b5c6d7e8f90a1b2c3.11400000" },
                form: "throwing",
              },
            ],
          },
        },
      ],
    });
    emitPotionRecipeReadModels(db);
    expect(
      db
        .query(
          "SELECT ingredient_ordinal, tag_ref_json FROM potion_recipe_ingredients ORDER BY ingredient_ordinal",
        )
        .all(),
    ).toEqual([
      {
        ingredient_ordinal: 0,
        tag_ref_json: '{"kind":"lookupAsset","guid":"0718293a4b5c6d7e8f90a1b2c3d4e5f6.11400000"}',
      },
      {
        ingredient_ordinal: 1,
        tag_ref_json: '{"kind":"lookupAsset","guid":"f60718293a4b5c6d7e8f90a1b2c3d4e5.11400000"}',
      },
    ]);
    expect(
      db
        .query("SELECT product_ordinal, form FROM potion_recipe_products ORDER BY product_ordinal")
        .all(),
    ).toEqual([
      { product_ordinal: 0, form: "drinkable" },
      { product_ordinal: 1, form: "throwing" },
    ]);
    const edges = db
      .query("SELECT target_type, predicate FROM entity_edges ORDER BY target_type, predicate")
      .all();
    expect(edges).toContainEqual({ target_type: "item", predicate: "brews_into" });
    expect(edges).toContainEqual({ target_type: "status-effect", predicate: "grants_effect" });
    expect(edges).toContainEqual({ target_type: "item-tag", predicate: "requires_tag" });
    expect(edges).not.toContainEqual({ target_type: "item", predicate: "requires_tag" });
    expect(db.query("SELECT name FROM potion_recipe_overview_rows").get()).toEqual({
      name: "Burning",
    });
    const presentation = db
      .query<{ products_json: string; skill_requirement: number | null }, []>(
        "SELECT products_json, skill_requirement FROM potion_recipe_presentation_rows",
      )
      .get();
    expect(JSON.parse(presentation!.products_json).map((x: { form: string }) => x.form)).toEqual([
      "drinkable",
      "throwing",
    ]);
    expect(presentation!.skill_requirement).toBeNull();
  });

  it("reuses applies for enchantment status effects and supports no-item enchantments", () => {
    const db = new Database(":memory:");
    db.exec(ENCHANTMENT_DDL);
    db.exec(ENTITY_GRAPH_DDL);
    seedNode(db, "item", "c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000", "Sword", "/items/item-a");
    seedNode(
      db,
      "status-effect",
      "e5f60718293a4b5c6d7e8f90a1b2c3d4.11400000",
      "Burning",
      "/status-effects/status-a",
    );
    canonicaliseEnchantments(db, {
      entityId: "enchantment",
      schemaVersion: 1,
      rows: [
        {
          id: "a1b2c3d4e5f60718293a4b5c6d7e8f90.11400000",
          fields: {
            id: "a1b2c3d4e5f60718293a4b5c6d7e8f90.11400000",
            enchantmentName: "Burning",
            moneyValue: 10,
            hideEffectTooltips: false,
            appliesToItemRefs: [
              { kind: "lookupAsset", guid: "c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000" },
            ],
            effects: [
              {
                ordinal: 0,
                kind: "StatusEffectEnchantmentEffect",
                statusEffectRef: {
                  kind: "lookupAsset",
                  guid: "e5f60718293a4b5c6d7e8f90a1b2c3d4.11400000",
                },
              },
            ],
          },
        },
        {
          id: "b2c3d4e5f60718293a4b5c6d7e8f90a1.11400000",
          fields: {
            id: "b2c3d4e5f60718293a4b5c6d7e8f90a1.11400000",
            enchantmentName: "Particle",
            moneyValue: 5,
            hideEffectTooltips: true,
            appliesToItemRefs: [],
            effects: [{ ordinal: 0, kind: "MeleeParticleEchantmentEffect", statusEffectRef: null }],
          },
        },
      ],
    });
    emitEnchantmentReadModels(db);
    expect(
      db
        .query("SELECT source_type, target_type, predicate FROM entity_edges ORDER BY predicate")
        .all(),
    ).toEqual([
      { source_type: "enchantment", target_type: "status-effect", predicate: "applies" },
      { source_type: "enchantment", target_type: "item", predicate: "enchants" },
    ]);
    expect(
      db
        .query(
          "SELECT COUNT(*) AS count FROM enchantment_items WHERE enchantment_id = 'b2c3d4e5f60718293a4b5c6d7e8f90a1.11400000'",
        )
        .get(),
    ).toEqual({ count: 0 });
    expect(relationshipRegistry.applies.inverseTitle).toEqual({
      item: "Applied by items",
      spell: "Applied by spells",
      enchantment: "Applied by enchantments",
    });
  });

  it("uses a recipe placeholder and diagnostic when its status effect cannot resolve", () => {
    const db = new Database(":memory:");
    db.exec(POTION_RECIPE_DDL);
    db.exec(ENTITY_GRAPH_DDL);
    canonicalisePotionRecipes(db, {
      entityId: "potion-recipe",
      schemaVersion: 1,
      rows: [
        {
          id: "638932f242126f24a801724271ae6714.11400000",
          fields: {
            id: "638932f242126f24a801724271ae6714.11400000",
            statusEffectRef: {
              kind: "lookupAsset",
              guid: "missing-status-effect",
            },
            lockedByDefault: false,
            enableSkillRequirement: false,
            skillRequirement: 0,
            levelModifier: 0,
            successModifier: 0,
            ingredients: [],
            producedRefs: [],
          },
        },
      ],
    });

    const diagnostics = emitPotionRecipeReadModels(db, "/potion-recipes");

    expect(db.query("SELECT name FROM potion_recipe_overview_rows").get()).toEqual({
      name: "Unnamed potion recipe",
    });
    expect(
      db.query("SELECT label FROM entity_nodes WHERE entity_type = 'potion-recipe'").get(),
    ).toEqual({ label: "Unnamed potion recipe" });
    expect(
      db.query("SELECT predicate FROM entity_edges WHERE predicate = 'grants_effect'").all(),
    ).toEqual([]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "potionRecipeReferenceUnresolved",
        field: "potion_recipes.status_effect_ref_json",
      }),
    ]);
    db.close();
  });

  it("omits a product it cannot resolve rather than publishing an empty slot", () => {
    const db = new Database(":memory:");
    db.exec(POTION_RECIPE_DDL);
    db.exec(ENTITY_GRAPH_DDL);
    seedNode(db, "item", "c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000", "Drink", "/items/item-a");
    seedNode(
      db,
      "status-effect",
      "e5f60718293a4b5c6d7e8f90a1b2c3d4.11400000",
      "Burning",
      "/status-effects/burning",
    );
    canonicalisePotionRecipes(db, {
      entityId: "potion-recipe",
      schemaVersion: 1,
      rows: [
        {
          id: "638932f242126f24a801724271ae6714.11400000",
          fields: {
            id: "638932f242126f24a801724271ae6714.11400000",
            statusEffectRef: {
              kind: "lookupAsset",
              guid: "e5f60718293a4b5c6d7e8f90a1b2c3d4.11400000",
            },
            lockedByDefault: false,
            enableSkillRequirement: false,
            skillRequirement: 0,
            levelModifier: 0,
            successModifier: 0,
            ingredients: [],
            // The live game holds a recipe with an empty product slot. Publishing it as a
            // row of nulls is what broke a production deploy.
            producedRefs: [
              {
                ref: { kind: "lookupAsset", guid: "c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000" },
                form: "drinkable",
              },
              { ref: { kind: "missing", reason: "recipeProductMissing" }, form: "drinkable" },
            ],
          },
        },
      ],
    });

    const diagnostics = emitPotionRecipeReadModels(db, "/potion-recipes");

    const products = JSON.parse(
      db
        .query<{ products_json: string }, []>(
          "SELECT products_json FROM potion_recipe_presentation_rows",
        )
        .get()!.products_json,
    ) as { itemId: string | null }[];
    expect(products).toHaveLength(1);
    expect(products[0]?.itemId).toBe("c3d4e5f60718293a4b5c6d7e8f90a1b2.11400000");
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "potionRecipeReferenceUnresolved" }),
    ]);
    db.close();
  });
});

function seedNode(
  db: Database,
  entityType: string,
  entityId: string,
  label: string,
  routePath: string,
): void {
  db.prepare(
    `INSERT INTO entity_nodes (
    entity_type, entity_id, label, display_label, route_path, canonical_slug, short_id, has_page
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(entityType, entityId, label, label, routePath, entityId, entityId);
}
