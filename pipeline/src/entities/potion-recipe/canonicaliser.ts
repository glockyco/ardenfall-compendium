import type { Database } from "bun:sqlite";
import type { PotionRecipeSnapshotFields, SnapshotEnvelope, SnapshotRef } from "../../types.ts";
import { entityRows } from "../../types.ts";

function refJson(ref: SnapshotRef): string {
  return JSON.stringify(ref);
}

export function canonicalisePotionRecipes(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO potion_recipes (
       id, recipe_name, locked_by_default, enable_skill_requirement,
       skill_requirement, level_modifier, success_modifier
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const ingredientInsert = db.prepare(
    `INSERT INTO potion_recipe_ingredients (
       id, potion_recipe_id, ingredient_ordinal, tag_ref_json, count
     ) VALUES (?, ?, ?, ?, ?)`,
  );
  const productInsert = db.prepare(
    `INSERT INTO potion_recipe_products (
       id, potion_recipe_id, product_ordinal, item_ref_json, form
     ) VALUES (?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of entityRows<PotionRecipeSnapshotFields>(envelope)) {
      const fields = row.fields;
      insert.run(
        row.id,
        fields.recipeName ?? null,
        fields.lockedByDefault === undefined || fields.lockedByDefault === null
          ? null
          : fields.lockedByDefault
            ? 1
            : 0,
        fields.enableSkillRequirement === undefined || fields.enableSkillRequirement === null
          ? null
          : fields.enableSkillRequirement
            ? 1
            : 0,
        fields.skillRequirement ?? null,
        fields.levelModifier ?? null,
        fields.successModifier ?? null,
      );
      for (const [ordinal, ingredient] of (fields.ingredients ?? []).entries()) {
        ingredientInsert.run(
          `${row.id}:ingredient:${ordinal}`,
          row.id,
          ordinal,
          refJson(ingredient.tagRef),
          ingredient.count,
        );
      }
      for (const [ordinal, product] of (fields.producedRefs ?? []).entries()) {
        productInsert.run(
          `${row.id}:product:${ordinal}`,
          row.id,
          ordinal,
          refJson(product.ref),
          product.form,
        );
      }
    }
  });
  tx();
}
