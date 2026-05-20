[← Previous phase](12-enchantment.md) · [Next phase →](14-item-rework.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 13: `potion-recipe` entity

**Spec coverage:** §3.2.

**Why thirteenth:** `PotionRecipeItemData` already carries an embedded `PotionRecipeSnapshot` (Slice 2) inside its item snapshot, but it is not promoted to a canonical entity with public pages. With status-effects (Phase 10) and item-tags (Phase 6) now public, the recipe page can cross-link: `produces_drinkable_potion` → item, `produces_throwing_potion` → item, `requires_tag` → item-tag, `applies_status_effect` → status-effect (via the produced potions). Phase 13 instantiates the small-entity template for recipes.

**Outcome:** every `PotionRecipe` asset is exported as a top-level entity with `recipeName` (derived from first produced potion's `GetEffectName()`), `drinkablePotionRefs`, `throwingPotionRefs`, `ingredients`, skill / level / success modifiers; `/recipes` + `/recipes/[slug]` render; reverse cross-links from items and ingredient tags resolve.

## Template instantiation

Phase 13 instantiates the **small-entity template** from [04-stat-type.md](04-stat-type.md) with one extension (derived recipe name).

| Template parameter          | Phase 13 value                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity id                   | `potion-recipe`                                                                                                                                      |
| Plural id                   | `potion-recipes`                                                                                                                                     |
| Asset C# type               | `Ardenfall.Item.PotionRecipe`                                                                                                                        |
| Mod namespace               | `ArdenfallCompendium.Entities.PotionRecipe`                                                                                                          |
| Adapter file                | `mod/src/Entities/PotionRecipe/PotionRecipeExtractor.cs`                                                                                             |
| Snapshot DTO                | `mod/src/Entities/PotionRecipe/PotionRecipeEntitySnapshot.cs` (distinct name from the existing `PotionRecipeSnapshot` already on `PotionRecipeItem`) |
| Snapshot envelope           | `fixtures/synthetic/snapshot/potion-recipes.json`                                                                                                    |
| Pipeline canonical table    | `potion_recipes`                                                                                                                                     |
| Pipeline overview table     | `potion_recipe_overview_rows`                                                                                                                        |
| Pipeline presentation table | `potion_recipe_presentation_rows`                                                                                                                    |
| Render context              | `potion-recipe-presentation-v1`                                                                                                                      |
| Site overview route         | `/recipes`                                                                                                                                           |
| Site detail route           | `/recipes/[slug]`                                                                                                                                    |
| Plural breadcrumb           | `Recipes`                                                                                                                                            |
| Singular breadcrumb         | `Recipe`                                                                                                                                             |
| Slug source                 | `recipeName ?? '(unnamed-recipe)'`                                                                                                                   |
| Grouping rule               | None (single flat list)                                                                                                                              |

## Phase-13-specific deviations

- **`recipeName` is derived, not raw.** Per `PotionRecipe.cs:32-39`, the name reads `drinkablePotions[0].GetEffectName()` if `hasDrinkingPotions`, else `throwingPotions[0].GetEffectName()`. The mod extractor must resolve the first produced potion (via the already-extracted item) and pull its `effectName` (already on `ThrowingPotionData` per `ExtractThrowingPotion.cs:23`). If the recipe is invalid (no produced potions), `recipeName` is `null` and the slug falls back to `unnamed-recipe--<id8>`.
- **`ingredients` is a typed list**, not refs. Each entry is `{ tagRef, count }`. The recipe page resolves `tagRef` → tag name via the canonical `item-tag` slug.
- **No cross-entity-link emission in this phase** — Phase 15 wires the `produces_drinkable_potion`, `produces_throwing_potion`, `requires_tag` edges. Phase 13 only populates the source rows.

## Tasks

### Task 13.1: Mod DTO

```cs
// mod/src/Entities/PotionRecipe/PotionRecipeEntitySnapshot.cs
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.PotionRecipe;

public sealed record PotionRecipeEntitySnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("recipeName")] string? RecipeName,
    [property: JsonProperty("drinkablePotionRefs")] List<object?> DrinkablePotionRefs,
    [property: JsonProperty("throwingPotionRefs")] List<object?> ThrowingPotionRefs,
    [property: JsonProperty("lockedByDefault")] bool LockedByDefault,
    [property: JsonProperty("enableSkillRequirement")] bool EnableSkillRequirement,
    [property: JsonProperty("skillRequirement")] int SkillRequirement,
    [property: JsonProperty("levelModifier")] float LevelModifier,
    [property: JsonProperty("successModifier")] float SuccessModifier,
    [property: JsonProperty("ingredients")] List<PotionRecipeIngredientSnapshot> Ingredients);

public sealed record PotionRecipeIngredientSnapshot(
    [property: JsonProperty("tagRef")] object? TagRef,
    [property: JsonProperty("count")] int Count);
```

Tests + commit: `feat(mod): potion-recipe entity snapshot DTOs`.

### Task 13.2: Mod extractor

Walk `BuiltLookupTable.GetAssetsOfType<PotionRecipe>()`. For each asset, derive `recipeName` by reading `asset.RecipeName` (the existing computed property that already does the `drinkablePotions[0].GetEffectName()` fallback). Resolve `drinkablePotions[]`, `throwingPotions[]`, ingredients via the ref resolver.

Tests cover: extraction with valid drinkable + throwing potions; extraction with invalid recipe (no potions) producing `recipeName: null`; ingredient count > 0.

Commit: `feat(mod): extract potion-recipe entity snapshots`.

### Task 13.3: Walker registration

Register the extractor (entityId `potion-recipes`).

Commit: `feat(mod): emit potion-recipe artifact alongside items`.

### Task 13.4: Pipeline descriptor + canonicaliser + read-model

Descriptor at `entities/potion-recipe/entity.json`.

```sql
CREATE TABLE potion_recipes (
  id                            TEXT PRIMARY KEY,
  recipe_name                   TEXT,
  drinkable_potion_refs_json    TEXT NOT NULL DEFAULT '[]',
  throwing_potion_refs_json     TEXT NOT NULL DEFAULT '[]',
  locked_by_default             INTEGER NOT NULL DEFAULT 0,
  enable_skill_requirement      INTEGER NOT NULL DEFAULT 0,
  skill_requirement             INTEGER NOT NULL DEFAULT 0,
  level_modifier                REAL NOT NULL DEFAULT 0,
  success_modifier              REAL NOT NULL DEFAULT 0,
  ingredients_json              TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE potion_recipe_overview_rows (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,             -- coalesces null recipe_name → "Unnamed recipe"
  potion_count INTEGER NOT NULL DEFAULT 0,
  is_valid     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE potion_recipe_presentation_rows (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  render_context         TEXT NOT NULL,
  drinkable_potions_json TEXT NOT NULL DEFAULT '[]',
  throwing_potions_json  TEXT NOT NULL DEFAULT '[]',
  ingredients_json       TEXT NOT NULL DEFAULT '[]',
  skill_requirement      INTEGER NOT NULL DEFAULT 0,
  enable_skill_requirement INTEGER NOT NULL DEFAULT 0,
  locked_by_default      INTEGER NOT NULL DEFAULT 0,
  level_modifier         REAL NOT NULL DEFAULT 0,
  success_modifier       REAL NOT NULL DEFAULT 0
);
```

`potion_recipe_overview_rows.name` falls back to `"Unnamed recipe"` when `recipe_name IS NULL`.

`entity_nodes` insertion uses `deriveSlug({displayName: recipeName ?? "Unnamed recipe", assetId: id})`.

Commits:

- `feat(pipeline): add potion-recipe entity descriptor`
- `feat(pipeline): canonicalise potion-recipe snapshots`
- `feat(pipeline): emit potion-recipe read models`

### Task 13.5: Fixture rows

`fixtures/synthetic/snapshot/potion-recipes.json`:

```json
{
  "entityId": "potion-recipe",
  "schemaVersion": 1,
  "rows": [
    {
      "id": "fixture-recipe-stamina-draught",
      "recipeName": "Stamina Draught",
      "drinkablePotionRefs": [{ "kind": "lookupAsset", "guid": "fixture-stamina-draught" }],
      "throwingPotionRefs": [],
      "lockedByDefault": false,
      "enableSkillRequirement": false,
      "skillRequirement": 0,
      "levelModifier": 0,
      "successModifier": 0,
      "ingredients": [
        { "tagRef": { "kind": "lookupAsset", "guid": "fixture-tag-stamina-leaf" }, "count": 2 }
      ]
    }
  ],
  "diagnostics": []
}
```

Refresh hashes.

Commit: `test(pipeline): add potion-recipe fixture rows`.

### Task 13.6: Site overview + detail routes

Apply Task 4.8's pattern:

- `/recipes` lists recipes sorted by `name`; rows that have `recipe_name IS NULL` render as "Unnamed recipe" with reduced emphasis.
- `/recipes/[slug]` shows ingredients (each links to `/tags/<slug>`), drinkable potions (links to `/items/<slug>`), throwing potions (links), skill requirement, level + success modifiers, "Locked by default" flag.

Components: `PotionRecipeOverview.svelte`, `PotionRecipeDetail.svelte`, `PotionRecipeIngredientList.svelte`, `PotionRecipeProductList.svelte`.

Commit: `feat(site): render potion-recipe pages`.

### Task 13.7: Phase 13 verification gate

- [ ] Run the standard phase gate.
- [ ] Visit `/recipes` and `/recipes/stamina-draught--<id8>`; confirm content + cross-links.
- [ ] Update coordinator phase index row 13 status to ✅.

---

## Checkpoint 4: end of "every public entity" group

After Phase 13, **stop and review** before opening Phase 14.

You now have:

- Seven public entity types live with composed presentation pages.
- Item tooltip composition has all the substrate it needs.
- Slug machinery exercised across every entity type at fixture scale.

Phases 14–17 wire items into the new entities, rebuild the relationship graph with forward + reverse sections, cut item routes over to the new slug shape, and release.

---

[← Previous phase](12-enchantment.md) · [Next phase →](14-item-rework.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
