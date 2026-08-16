import type { Database } from "bun:sqlite";
import type { PipelineDiagnostic } from "../../relationships/relationship-graph.ts";
import { ENTITY_GRAPH_DDL } from "../../relationships/relationship-graph.ts";
import { deriveEntityNodeSlug, prepareEntityNodeWriter } from "../../relationships/entity-nodes.ts";
import { prepareEntityLinkResolver } from "../../relationships/entity-links.ts";
import type { SnapshotRef } from "../../types.ts";

export const POTION_RECIPE_READ_MODEL_DDL = `
CREATE TABLE potion_recipe_overview_rows (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  locked_by_default     INTEGER NOT NULL DEFAULT 0,
  enable_skill_requirement INTEGER NOT NULL DEFAULT 0,
  skill_requirement     INTEGER
);
CREATE TABLE potion_recipe_presentation_rows (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  render_context        TEXT NOT NULL,
  locked_by_default     INTEGER NOT NULL,
  skill_requirement     INTEGER,
  level_modifier        REAL NOT NULL,
  success_modifier      REAL NOT NULL,
  ingredients_json      TEXT NOT NULL,
  products_json         TEXT NOT NULL
);
`;

interface RecipeRow {
  id: string;
  status_effect_ref_json: string;
  locked_by_default: number | null;
  enable_skill_requirement: number | null;
  skill_requirement: number | null;
  level_modifier: number | null;
  success_modifier: number | null;
}
interface IngredientRow {
  potion_recipe_id: string;
  ingredient_ordinal: number;
  tag_ref_json: string;
  count: number;
}
interface ProductRow {
  potion_recipe_id: string;
  product_ordinal: number;
  item_ref_json: string;
  form: string;
}
interface NodeRow {
  label: string | null;
  has_page: number;
}
interface IngredientPresentation {
  tagId: string | null;
  tagLabel: string | null;
  tagRoutePath: string | null;
  count: number;
}
interface ProductPresentation {
  itemId: string | null;
  itemLabel: string | null;
  itemRoutePath: string | null;
  form: "drinkable" | "throwing";
}

export function emitPotionRecipeReadModels(
  db: Database,
  routeBase = "/potion-recipes",
): PipelineDiagnostic[] {
  db.exec(POTION_RECIPE_READ_MODEL_DDL);
  db.exec(ENTITY_GRAPH_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO potion_recipe_overview_rows (id, name, locked_by_default, enable_skill_requirement, skill_requirement)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const presentationInsert = db.prepare(
    `INSERT INTO potion_recipe_presentation_rows (
       id, name, render_context, locked_by_default, skill_requirement,
       level_modifier, success_modifier, ingredients_json, products_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const edgeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_edges (
       edge_id, source_type, source_id, target_type, target_id, predicate,
       label, weight, evidence_json, anchor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const writeNode = prepareEntityNodeWriter(db);
  const recipes = db
    .query<RecipeRow, []>(
      `SELECT id, status_effect_ref_json, locked_by_default, enable_skill_requirement,
            skill_requirement, level_modifier, success_modifier
     FROM potion_recipes
     ORDER BY id`,
    )
    .all();
  const ingredientsByRecipe = new Map<string, IngredientRow[]>();
  for (const row of db
    .query<IngredientRow, []>(
      `SELECT potion_recipe_id, ingredient_ordinal, tag_ref_json, count
     FROM potion_recipe_ingredients ORDER BY potion_recipe_id, ingredient_ordinal`,
    )
    .all()) {
    const rows = ingredientsByRecipe.get(row.potion_recipe_id) ?? [];
    rows.push(row);
    ingredientsByRecipe.set(row.potion_recipe_id, rows);
  }
  const productsByRecipe = new Map<string, ProductRow[]>();
  for (const row of db
    .query<ProductRow, []>(
      `SELECT potion_recipe_id, product_ordinal, item_ref_json, form
     FROM potion_recipe_products ORDER BY potion_recipe_id, product_ordinal`,
    )
    .all()) {
    const rows = productsByRecipe.get(row.potion_recipe_id) ?? [];
    rows.push(row);
    productsByRecipe.set(row.potion_recipe_id, rows);
  }
  const resolveLink = prepareEntityLinkResolver(db);
  const nodes = new Map<string, NodeRow>();
  for (const node of db
    .query<NodeRow & { entity_type: string; entity_id: string }, []>(
      `SELECT entity_type, entity_id, label, has_page FROM entity_nodes`,
    )
    .all())
    nodes.set(`${node.entity_type}:${node.entity_id}`, node);
  const statusEffectTarget = (row: RecipeRow): { id: string; node: NodeRow } | null => {
    const ref = parseRef(row.status_effect_ref_json);
    const id = resolveRef(ref, "status-effect");
    const node = id === null ? undefined : nodes.get(`status-effect:${id}`);
    return id === null || !node ? null : { id, node };
  };
  recipes.sort((left, right) => {
    const leftName = statusEffectTarget(left)?.node.label?.trim() || "Unnamed potion recipe";
    const rightName = statusEffectTarget(right)?.node.label?.trim() || "Unnamed potion recipe";
    return leftName.localeCompare(rightName) || left.id.localeCompare(right.id);
  });
  const diagnostics: PipelineDiagnostic[] = [];
  const tx = db.transaction(() => {
    for (const row of recipes) {
      const statusEffectTargetNode = statusEffectTarget(row);
      const name = statusEffectTargetNode?.node.label?.trim() || "Unnamed potion recipe";
      if (statusEffectTargetNode === null) {
        diagnostics.push(
          unresolvedDiagnostic(
            row.id,
            "status-effect",
            row.status_effect_ref_json,
            "potion_recipes.status_effect_ref_json",
          ),
        );
      } else {
        edgeInsert.run(
          `${row.id}:grants_effect:status-effect:${statusEffectTargetNode.id}`,
          "potion-recipe",
          row.id,
          "status-effect",
          statusEffectTargetNode.id,
          "grants_effect",
          "Effect",
          1,
          JSON.stringify({ source: "potion_recipes.status_effect_ref_json" }),
          null,
        );
      }
      overviewInsert.run(
        row.id,
        name,
        row.locked_by_default ?? 0,
        row.enable_skill_requirement ?? 0,
        row.skill_requirement,
      );
      const slug = deriveEntityNodeSlug(name, row.id);
      writeNode({
        entityType: "potion-recipe",
        entityId: row.id,
        label: name,
        routePath: `${routeBase}/${slug.canonicalSlug}`,
        canonicalSlug: slug.canonicalSlug,
        shortId: slug.shortId,
      });
      const ingredients: IngredientPresentation[] = [];
      for (const ingredient of ingredientsByRecipe.get(row.id) ?? []) {
        const ref = parseRef(ingredient.tag_ref_json);
        const targetId = resolveRef(ref, "item-tag");
        const target = targetId === null ? undefined : nodes.get(`item-tag:${targetId}`);
        const link = targetId === null ? null : resolveLink("item-tag", targetId);
        if (targetId === null || !target || !link) {
          diagnostics.push(
            unresolvedDiagnostic(
              row.id,
              "item-tag",
              ingredient.tag_ref_json,
              "potion_recipe_ingredients.tag_ref_json",
            ),
          );
          continue;
        }
        edgeInsert.run(
          `${row.id}:requires_tag:item-tag:${targetId}`,
          "potion-recipe",
          row.id,
          "item-tag",
          targetId,
          "requires_tag",
          "Ingredients",
          ingredient.count,
          JSON.stringify({
            source: "potion_recipe_ingredients",
            ordinal: ingredient.ingredient_ordinal,
            count: ingredient.count,
          }),
          null,
        );
        ingredients.push({
          tagId: targetId,
          tagLabel: link.label,
          tagRoutePath: link.routePath,
          count: ingredient.count,
        });
      }
      const producedRefs: ProductPresentation[] = [];
      for (const product of productsByRecipe.get(row.id) ?? []) {
        const ref = parseRef(product.item_ref_json);
        const targetId = resolveRef(ref, "item");
        const target = targetId === null ? undefined : nodes.get(`item:${targetId}`);
        const link = targetId === null ? null : resolveLink("item", targetId);
        if (targetId === null || !target || !link) {
          diagnostics.push(
            unresolvedDiagnostic(
              row.id,
              "item",
              product.item_ref_json,
              "potion_recipe_products.item_ref_json",
            ),
          );
          continue;
        }
        edgeInsert.run(
          `${row.id}:brews_into:item:${targetId}`,
          "potion-recipe",
          row.id,
          "item",
          targetId,
          "brews_into",
          "Produces",
          1,
          JSON.stringify({
            source: "potion_recipe_products",
            ordinal: product.product_ordinal,
            form: product.form,
          }),
          null,
        );
        producedRefs.push({
          itemId: targetId,
          itemLabel: link.label,
          itemRoutePath: link.routePath,
          form: product.form === "throwing" ? "throwing" : "drinkable",
        });
      }
      const skillRequirement = row.enable_skill_requirement === 1 ? row.skill_requirement : null;
      presentationInsert.run(
        row.id,
        name,
        "potion-recipe-presentation-v1",
        row.locked_by_default ?? 0,
        skillRequirement,
        row.level_modifier ?? 0,
        row.success_modifier ?? 0,
        JSON.stringify(ingredients),
        JSON.stringify(producedRefs),
      );
    }
  });
  tx();
  return diagnostics;
}

function parseRef(value: string): SnapshotRef | null {
  try {
    const ref = JSON.parse(value) as SnapshotRef;
    return typeof ref === "object" && ref !== null && typeof ref.kind === "string" ? ref : null;
  } catch {
    return null;
  }
}
function resolveRef(ref: SnapshotRef | null, entity: string): string | null {
  if (!ref) return null;
  if (ref.kind === "lookupAsset") return ref.guid;
  if (ref.kind === "namedAsset" && ref.entity === entity) return `named;${entity};${ref.name}`;
  return null;
}
function unresolvedDiagnostic(
  recipeId: string,
  targetType: string,
  value: string,
  field: string,
): PipelineDiagnostic {
  return {
    severity: "diagnostic",
    source: "potion-recipe-read-model",
    code: "potionRecipeReferenceUnresolved",
    message: `Potion recipe '${recipeId}' has an unresolvable ${targetType} reference.`,
    entityType: "potion-recipe",
    entityId: recipeId,
    field,
    evidence: { reference: value },
  };
}
