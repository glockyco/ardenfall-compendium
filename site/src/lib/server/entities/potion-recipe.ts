import { all, get } from "../db";
import { isRecord, parseGeneratedJson, validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface PotionRecipeOverviewRecord {
  id: string;
  route_path: string;
  display_label: string;
}

interface PotionRecipePresentationRecord {
  id: string;
  render_context: string;
  locked_by_default: number;
  skill_requirement: number | null;
  level_modifier: number;
  success_modifier: number;
  ingredients_json: string;
  products_json: string;
  route_path: string;
  display_label: string;
}

export interface PotionRecipeIngredient {
  tagId: string;
  tagLabel: string;
  tagRoutePath: string | null;
  count: number;
}

export type PotionRecipeProductForm = "drinkable" | "throwing";

export interface PotionRecipeProduct {
  itemId: string;
  itemLabel: string;
  itemRoutePath: string | null;
  form: PotionRecipeProductForm;
}

export interface PotionRecipeOverviewRow {
  id: string;
  name: string;
  routePath: string;
}

export interface PotionRecipePresentationRow {
  id: string;
  name: string;
  renderContext: "potion-recipe-presentation-v1";
  lockedByDefault: boolean;
  skillRequirement: number | null;
  levelModifier: number;
  successModifier: number;
  ingredients: PotionRecipeIngredient[];
  producedRefs: PotionRecipeProduct[];
  routePath: string;
}

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
const isPotionRecipeIngredient = (value: unknown): value is PotionRecipeIngredient =>
  isRecord(value) &&
  typeof value.tagId === "string" &&
  typeof value.tagLabel === "string" &&
  isNullableString(value.tagRoutePath) &&
  typeof value.count === "number" &&
  Number.isInteger(value.count);
const isPotionRecipeIngredientArray = (value: unknown): value is PotionRecipeIngredient[] =>
  Array.isArray(value) && value.every(isPotionRecipeIngredient);
const isPotionRecipeProduct = (value: unknown): value is PotionRecipeProduct =>
  isRecord(value) &&
  typeof value.itemId === "string" &&
  typeof value.itemLabel === "string" &&
  isNullableString(value.itemRoutePath) &&
  (value.form === "drinkable" || value.form === "throwing");
const isPotionRecipeProductArray = (value: unknown): value is PotionRecipeProduct[] =>
  Array.isArray(value) && value.every(isPotionRecipeProduct);

export const listPotionRecipes = (): PotionRecipeOverviewRow[] =>
  all<PotionRecipeOverviewRecord>(
    `SELECT p.id, n.route_path, n.display_label
     FROM potion_recipe_overview_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'potion-recipe'
      AND n.entity_id = p.id
      AND n.has_page = 1
     ORDER BY n.display_label, p.id`,
  ).map((row) => ({ id: row.id, name: row.display_label, routePath: row.route_path }));

export const getPotionRecipePresentation = (
  slug: string,
): PotionRecipePresentationRow | undefined => {
  const node = getEntityNodeBySlug("potion-recipe", slug);
  if (!node) return undefined;
  const row = get<PotionRecipePresentationRecord>(
    `SELECT p.id, p.render_context, p.locked_by_default,
            p.skill_requirement, p.level_modifier, p.success_modifier,
            p.ingredients_json, p.products_json, n.route_path, n.display_label
     FROM potion_recipe_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'potion-recipe'
      AND n.entity_id = p.id
      AND n.has_page = 1
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.display_label,
    renderContext: validateRenderContext(
      row.render_context,
      "potion-recipe",
      row.id,
      "potion-recipe-presentation-v1",
    ),
    lockedByDefault: row.locked_by_default === 1,
    skillRequirement: row.skill_requirement,
    levelModifier: row.level_modifier,
    successModifier: row.success_modifier,
    ingredients: parseGeneratedJson(
      row.ingredients_json,
      "potion-recipe",
      "ingredients_json",
      row.id,
      isPotionRecipeIngredientArray,
    ),
    producedRefs: parseGeneratedJson(
      row.products_json,
      "potion-recipe",
      "products_json",
      row.id,
      isPotionRecipeProductArray,
    ),
    routePath: row.route_path,
  };
};
