export const POTION_RECIPE_DDL = `
CREATE TABLE potion_recipes (
  id                       TEXT PRIMARY KEY NOT NULL,
  recipe_name              TEXT,
  locked_by_default        INTEGER,
  enable_skill_requirement INTEGER,
  skill_requirement        INTEGER,
  level_modifier           REAL,
  success_modifier         REAL
);
CREATE TABLE potion_recipe_ingredients (
  id                    TEXT PRIMARY KEY,
  potion_recipe_id      TEXT NOT NULL REFERENCES potion_recipes(id),
  ingredient_ordinal    INTEGER NOT NULL,
  tag_ref_json          TEXT NOT NULL,
  count                 INTEGER NOT NULL,
  UNIQUE(potion_recipe_id, ingredient_ordinal)
);
CREATE TABLE potion_recipe_products (
  id                    TEXT PRIMARY KEY,
  potion_recipe_id      TEXT NOT NULL REFERENCES potion_recipes(id),
  product_ordinal       INTEGER NOT NULL,
  item_ref_json         TEXT NOT NULL,
  form                  TEXT NOT NULL,
  UNIQUE(potion_recipe_id, product_ordinal)
);
`;
