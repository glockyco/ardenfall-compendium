# Item Subtype Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not use subagents or worktrees unless the user explicitly changes the current instruction. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich item extraction so every `ItemData` subclass present in Ardenfall Demo 0.0.10.91 is represented by a descriptor-backed variant instead of being skipped or collapsed into an ancestor variant.

**Architecture:** Keep descriptors as the cross-subsystem source of truth. The mod classifies item assets from most-derived type to least-derived type, flattens each variant layer into the existing snapshot row shape, and emits compact DTOs for cross-domain or graph-heavy leaves rather than raw Unity/Odin/game-object JSON. The pipeline remains descriptor-driven; site presentation stays generic until the item presentation-depth slice.

**Tech Stack:** BepInEx C# `netstandard2.1`, Ardenfall `Assembly-CSharp.dll`, Bun/TypeScript pipeline, JSON Schema descriptors, SQLite canonical tables, SvelteKit generic item routes.

---

## Live diagnostics basis

Source snapshot: `snapshots/snapshots/0.0.10.91-20260514-0632448862090/diagnostics.json`.

The snapshot predates the runtime diagnostic-code rename, so it contains the legacy code `itemSubtypeUnsupportedInSlice1`. Current code emits `itemSubtypeUnsupported` through `ItemDiagnosticCodes.UnsupportedSubtype`; use the current code string for new tests and acceptance checks.

Unsupported diagnostics in the live snapshot:

| Unity type             | Count |
| ---------------------- | ----: |
| `ItemData`             |   254 |
| `NoteItemData`         |    65 |
| `ConsumableItemData`   |    46 |
| `CurrencyItemData`     |     4 |
| `LockpickItemData`     |     2 |
| `PotionRecipeItemData` |     2 |
| `RepairKitItemData`    |     1 |

Assembly reflection also shows item subclasses currently collapsed into ancestor variants because the extractor checks `PrimaryHandItemData` and `EquipItemData` before leaf types:

- `ArrowItemData : EquipItemData`
- `BowItemData : PrimaryHandItemData`
- `SlateSpellItemData : PrimaryHandItemData`
- `ThrowingItemData : PrimaryHandItemData`
- `ThrowingPotionData : ThrowingItemData`

This slice handles both groups. Success means a fresh live smoke has zero `itemSubtypeUnsupported` diagnostics.

## Scope boundaries

Included:

- Descriptor-backed item variants for every concrete `ItemData` subclass in the current Ardenfall assembly.
- Common item fields currently present on `ItemData` but not emitted in Slice 1.
- Compact DTO/JSON leaves for status effects, recipes, projectile settings, note sections, and spell references.
- Pipeline canonical tables and read models generated from descriptors.
- Tests proving classification order, descriptor loading, canonical SQL shape, and diagnostic elimination on fixture data.

Excluded:

- Icon/mesh/audio asset emission and rendering. `lookupAssetGuidMissing` for icons remains Slice 3 work.
- Spell entity extraction. Slate spell items emit spell references/compact leaves only; Slice 11 owns full spell pages.
- Rich note/book rendering and rich item tooltips. Slice 4 owns presentation depth.
- New maps, quests, vendors, monsters, or other entity roots.

## File structure

Create:

- `entities/item/variants/basic.json`
- `entities/item/variants/currency.json`
- `entities/item/variants/lockpick.json`
- `entities/item/variants/consumable.json`
- `entities/item/variants/note.json`
- `entities/item/variants/potion-recipe.json`
- `entities/item/variants/repair-kit.json`
- `entities/item/variants/arrow.json`
- `entities/item/variants/bow.json`
- `entities/item/variants/slate-spell.json`
- `entities/item/variants/throwing-item.json`
- `entities/item/variants/throwing-potion.json`
- `mod/src/Entities/Item/Adapters/ExtractBasicItem.cs`
- `mod/src/Entities/Item/Adapters/ExtractConsumable.cs`
- `mod/src/Entities/Item/Adapters/ExtractNote.cs`
- `mod/src/Entities/Item/Adapters/ExtractPotionRecipe.cs`
- `mod/src/Entities/Item/Adapters/ExtractRepairKit.cs`
- `mod/src/Entities/Item/Adapters/ExtractArrow.cs`
- `mod/src/Entities/Item/Adapters/ExtractBow.cs`
- `mod/src/Entities/Item/Adapters/ExtractSlateSpell.cs`
- `mod/src/Entities/Item/Adapters/ExtractThrowingItem.cs`
- `mod/src/Entities/Item/Adapters/ExtractThrowingPotion.cs`
- `mod/src/Entities/Item/Adapters/ItemAdapterHelpers.cs`
- `mod/src/Entities/Item/ItemVariantClassifier.cs`
- `mod-tests/ItemVariantClassifierTests.cs`
- `pipeline/test/item-subtypes.test.ts`

Modify:

- `schemas/variant.schema.json` — allow marker variants with zero variant-specific fields.
- `entities/item/entity.json` — add common `ItemData` fields and detail metadata.
- `mod/src/Entities/Item/ItemExtractor.cs` — delegate variant selection and layer extraction to `ItemVariantClassifier`.
- `mod/src/Entities/Item/Adapters/ExtractItem.cs` — emit common fields added to the root descriptor.
- `pipeline/test/invariants/items.test.ts` — assert descriptor/table coverage for new variants.
- `pipeline/test/read-models.test.ts` — assert detail JSON includes a new subtype field.
- `docs/superpowers/roadmap.md` — mark Slice 2 as in-progress during execution and done after live smoke passes.

---

### Task 1: Descriptor foundation and zero-field marker variants

**Files:**

- Modify: `schemas/variant.schema.json`
- Modify: `entities/item/entity.json`
- Create: `entities/item/variants/basic.json`
- Create: `entities/item/variants/currency.json`
- Test: `pipeline/test/item-subtypes.test.ts`

- [ ] **Step 1: Write descriptor tests**

Create `pipeline/test/item-subtypes.test.ts` with these tests:

```ts
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { loadDescriptors } from "../src/stages/load-descriptors.ts";
import { emitSqlite } from "../src/stages/emit-sqlite.ts";

const descriptorRoot = new URL("../../entities", import.meta.url).pathname;

describe("item subtype descriptors", () => {
  test("loads zero-field marker variants", async () => {
    const loaded = await loadDescriptors({ descriptorRoot });
    const variants = loaded.variants.item ?? [];

    expect(variants.find((variant) => variant.variantId === "basic")?.fields).toEqual([]);
    expect(variants.find((variant) => variant.variantId === "currency")?.fields).toEqual([]);
  });

  test("creates canonical tables for marker variants", async () => {
    const loaded = await loadDescriptors({ descriptorRoot });
    const db = new Database(":memory:");

    emitSqlite(db, loaded);

    expect(
      db.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'item_basic'").get(),
    ).toBeTruthy();
    expect(
      db
        .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'item_currency'")
        .get(),
    ).toBeTruthy();
  });
});
```

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: fails because `basic.json` and `currency.json` do not exist and the variant schema still requires at least one field.

- [ ] **Step 2: Allow zero-field variants**

In `schemas/variant.schema.json`, change the variant `fields` schema from:

```json
"minItems": 1,
```

to:

```json
"minItems": 0,
```

- [ ] **Step 3: Add common root item fields**

In `entities/item/entity.json`, keep the existing fields and add these root fields after `description`:

```json
{ "name": "stackable", "type": "boolean", "from": "stackable.Get()", "missingPolicy": "diagnostic" },
{ "name": "hideInGui", "type": "boolean", "from": "hideInGUI.Get()", "missingPolicy": "diagnostic" },
{ "name": "questItem", "type": "boolean", "from": "questItem.Get()", "missingPolicy": "diagnostic" },
{ "name": "notLootableChance", "type": "number", "from": "notLootableChance.Get()", "missingPolicy": "diagnostic" },
{ "name": "cannotBeOwned", "type": "boolean", "from": "cannotBeOwned.Get()", "missingPolicy": "diagnostic" },
{ "name": "quickslotIconRef", "type": "ref:asset", "from": "quickslotIcon", "missingPolicy": "optional-empty" },
{ "name": "category", "type": "string", "from": "category.Get()", "missingPolicy": "optional-empty" },
{ "name": "isIllegal", "type": "boolean", "from": "isIllegal.Get()", "missingPolicy": "diagnostic" }
```

Also add these fields to the `summary` or a new `Flags` detail section only if the generic UI remains readable; otherwise leave the detail sections unchanged and rely on `fields_json` until Slice 4.

- [ ] **Step 4: Add marker variant descriptors**

Create `entities/item/variants/basic.json`:

```json
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "basic",
  "label": "Basic Item",
  "unityType": "Ardenfall.Item.ItemData",
  "canonicalTable": "item_basic",
  "position": 1,
  "fields": []
}
```

Create `entities/item/variants/currency.json`:

```json
{
  "$schema": "../../../schemas/variant.schema.json",
  "variantId": "currency",
  "label": "Currency",
  "unityType": "Ardenfall.Item.CurrencyItemData",
  "canonicalTable": "item_currency",
  "parentVariantId": "basic",
  "position": 2,
  "fields": []
}
```

- [ ] **Step 5: Run descriptor tests**

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: passes.

- [ ] **Step 6: Commit**

```sh
git add schemas/variant.schema.json entities/item/entity.json entities/item/variants/basic.json entities/item/variants/currency.json pipeline/test/item-subtypes.test.ts
git commit -m "feat(items): add base item subtype descriptors"
```

### Task 2: Non-equipment subtype descriptors and adapters

**Files:**

- Create: `entities/item/variants/lockpick.json`
- Create: `entities/item/variants/consumable.json`
- Create: `entities/item/variants/note.json`
- Create: `entities/item/variants/potion-recipe.json`
- Create: `entities/item/variants/repair-kit.json`
- Create: `mod/src/Entities/Item/Adapters/ExtractBasicItem.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractConsumable.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractNote.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractPotionRecipe.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractRepairKit.cs`
- Create: `mod/src/Entities/Item/Adapters/ItemAdapterHelpers.cs`
- Modify: `mod/src/Entities/Item/Adapters/ExtractItem.cs`
- Test: `pipeline/test/item-subtypes.test.ts`

- [ ] **Step 1: Extend descriptor tests for unsupported live diagnostic types**

Add this case to `pipeline/test/item-subtypes.test.ts`:

```ts
test("describes every non-equipment subtype found in live diagnostics", async () => {
  const loaded = await loadDescriptors({ descriptorRoot });
  const variantIds = new Set((loaded.variants.item ?? []).map((variant) => variant.variantId));

  expect(variantIds).toEqual(
    expect.arrayContaining([
      "basic",
      "currency",
      "lockpick",
      "consumable",
      "note",
      "potion-recipe",
      "repair-kit",
    ]),
  );
});
```

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: fails because the new descriptors do not exist.

- [ ] **Step 2: Add non-equipment variant descriptors**

Create descriptors with these exact variant ids and fields:

| File                 | Parent  | Fields                                                                                                                                                                                                                                                                       |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lockpick.json`      | `basic` | `successChance:number` from `successChance.Get()`                                                                                                                                                                                                                            |
| `consumable.json`    | `basic` | `quickslotCooldownTime:number`, `statusEffectsJson:json`                                                                                                                                                                                                                     |
| `note.json`          | `basic` | `noteTextRef:ref:asset`, `noteText:string`, `noteSectionsJson:json`, `fontRef:ref:asset`, `gainStatRef:ref:asset`, `gainStatCount:integer`                                                                                                                                   |
| `potion-recipe.json` | `basic` | `recipeRef:ref:asset`, `recipeName:string`, `lockedByDefault:boolean`, `enableSkillRequirement:boolean`, `skillRequirement:integer`, `levelModifier:number`, `successModifier:number`, `ingredientsJson:json`, `drinkablePotionRefsJson:json`, `throwingPotionRefsJson:json` |
| `repair-kit.json`    | `basic` | `repairAddAmount:integer`, `repairPercentageAmount:number`, `repairSkillAddAmount:number`, `repairSkillMultAmount:number`                                                                                                                                                    |

Use `canonicalTable` names `item_lockpicks`, `item_consumables`, `item_notes`, `item_potion_recipes`, and `item_repair_kits`. Use positions 20, 30, 40, 50, and 60.

- [ ] **Step 3: Add adapter helper DTOs**

Create `mod/src/Entities/Item/Adapters/ItemAdapterHelpers.cs` with compact DTO helpers. Include these DTO shapes and do not serialize raw Unity objects:

```csharp
internal sealed record LeveledStatusEffectSnapshot(object? StatusEffectRef, float Level, float Lifetime, string? StackMode);
internal sealed record NoteSectionSnapshot(string? TextContent, object? ImageRef, bool Separator);
internal sealed record RecipeIngredientSnapshot(object? TagRef, int Count);
internal sealed record PotionRecipeSnapshot(
    string? RecipeName,
    bool IsValid,
    bool HasDrinkingPotions,
    bool HasThrowingPotions,
    bool LockedByDefault,
    bool EnableSkillRequirement,
    int SkillRequirement,
    float LevelModifier,
    float SuccessModifier,
    List<RecipeIngredientSnapshot> Ingredients,
    List<object?> DrinkablePotionRefs,
    List<object?> ThrowingPotionRefs);
```

The helper methods should accept `RefResolver refs` and the current row id so nested Unity object references go through `refs.ResolveAsset(..., MissingPolicy.OptionalEmpty, source: ...)`.

- [ ] **Step 4: Extend common root extraction**

Modify `ExtractItem.Extract` to populate the new root fields. Use `ProvenanceCapture.ForParameter<T>()` for `Parameter<T>` values and `refs.ResolveAsset()` for `quickslotIconRef` and `category`.

- [ ] **Step 5: Add non-equipment adapters**

Create one adapter per non-equipment variant. Each adapter returns `IReadOnlyDictionary<string, object?>` and only emits fields declared by its descriptor.

- [ ] **Step 6: Run mod build**

Run:

```sh
dotnet build mod/ArdenfallCompendium.csproj -c Debug
```

Expected: exits 0.

- [ ] **Step 7: Run descriptor tests**

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: passes.

- [ ] **Step 8: Commit**

```sh
git add entities/item/variants/lockpick.json entities/item/variants/consumable.json entities/item/variants/note.json entities/item/variants/potion-recipe.json entities/item/variants/repair-kit.json mod/src/Entities/Item/Adapters pipeline/test/item-subtypes.test.ts mod/src/Entities/Item/Adapters/ExtractItem.cs
git commit -m "feat(items): extract non-equipment item subtypes"
```

### Task 3: Equipment leaf subtype descriptors and adapters

**Files:**

- Create: `entities/item/variants/arrow.json`
- Create: `entities/item/variants/bow.json`
- Create: `entities/item/variants/slate-spell.json`
- Create: `entities/item/variants/throwing-item.json`
- Create: `entities/item/variants/throwing-potion.json`
- Create: `mod/src/Entities/Item/Adapters/ExtractArrow.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractBow.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractSlateSpell.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractThrowingItem.cs`
- Create: `mod/src/Entities/Item/Adapters/ExtractThrowingPotion.cs`
- Test: `pipeline/test/item-subtypes.test.ts`

- [ ] **Step 1: Extend descriptor tests for equipment leaves**

Add this case to `pipeline/test/item-subtypes.test.ts`:

```ts
test("describes equipment leaf subtypes before ancestor fallbacks", async () => {
  const loaded = await loadDescriptors({ descriptorRoot });
  const variants = loaded.variants.item ?? [];
  const byId = new Map(variants.map((variant) => [variant.variantId, variant]));

  expect(byId.get("arrow")?.parentVariantId).toBe("equipment");
  expect(byId.get("bow")?.parentVariantId).toBe("primary-hand");
  expect(byId.get("slate-spell")?.parentVariantId).toBe("primary-hand");
  expect(byId.get("throwing-item")?.parentVariantId).toBe("primary-hand");
  expect(byId.get("throwing-potion")?.parentVariantId).toBe("throwing-item");
});
```

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: fails because the descriptors do not exist.

- [ ] **Step 2: Add equipment leaf descriptors**

Create descriptors with these exact variant ids, canonical tables, parents, and field sets:

| Variant           | Canonical table         | Parent          | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arrow`           | `item_arrows`           | `equipment`     | `damage:number`, `spawnVisualOnHitStatic:boolean`, `spawnVisualOnHitCharacter:boolean`, `respawnItemPickupChance:number`, `addItemToInventoryChance:number`, `projectileSettingsJson:json`, `projectileRef:ref:asset`, `hitMaterialSoundRef:ref:asset`                                                                                                                                                                                                                                                                                                                                        |
| `bow`             | `item_bows`             | `primary-hand`  | `itemTypeTooltip:string`, `damage:number`, `bleedMultiplier:number`, `shootStaminaMultiplier:number`, `criticalHitChance:number`, `stunChance:number`, `bleedChance:number`, `critDamageMult:number`, `knockbackStrength:number`, `stealthHitMultiplier:number`, `ammoMassMultiplier:number`, `damageFalloffDistance:number`, `damageFalloff:number`, `durabilityMax:integer`, `projectileSlot:string`, `projectileIconRef:ref:asset`, `aimAnimationSpeedMultiplier:number`, `bleedStatusEffectJson:json`, `itemAIBehavior:string`                                                            |
| `slate-spell`     | `item_slate_spells`     | `primary-hand`  | `quickslotSecondaryColor:string`, `spellDataJson:json`, `secondarySpellDataJson:json`, `spawnWhenSheathed:boolean`, `spellItemType:string`, `durabilityMax:integer`, `manaCostMultiplier:number`                                                                                                                                                                                                                                                                                                                                                                                              |
| `throwing-item`   | `item_throwing_items`   | `primary-hand`  | `itemTypeTooltip:string`, `missileRef:ref:asset`, `missileRotationJson:json`, `damage:number`, `pierceArmor:boolean`, `bleedMultiplier:number`, `damageFalloffDistance:number`, `damageFalloff:number`, `critChance:number`, `stunChance:number`, `bleedChance:number`, `critDamageMult:number`, `quickslotCooldownTime:number`, `bleedStatusEffectJson:json`, `stealthHitMultiplier:number`, `spawnVisualOnHitStatic:boolean`, `spawnVisualOnHitCharacter:boolean`, `respawnItemPickupChance:number`, `addItemToInventoryChance:number`, `missileSettingsJson:json`, `itemAIBehavior:string` |
| `throwing-potion` | `item_throwing_potions` | `throwing-item` | `quickslotSecondaryColor:string`, `areaOfEffectRange:number`, `areaOfEffectJson:json`, `visualLevel:integer`, `isDrinkingPotion:boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Use positions 70, 80, 90, 100, and 110. Keep audio fields out of this slice; asset/audio rendering is Slice 3/presentation depth work.

- [ ] **Step 3: Add equipment leaf adapters**

Create one adapter per leaf type. Use `refs.ResolveAsset` for Unity object fields, `Enum.ToString()` for enum fields, and compact JSON DTOs for `ProjectileSettings`, `Vector3`, `Color`, `LeveledStatusEffect`, and spell data. Do not use Newtonsoft to serialize game objects directly.

- [ ] **Step 4: Run mod build and descriptor tests**

Run:

```sh
dotnet build mod/ArdenfallCompendium.csproj -c Debug
bun test pipeline/test/item-subtypes.test.ts
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```sh
git add entities/item/variants/arrow.json entities/item/variants/bow.json entities/item/variants/slate-spell.json entities/item/variants/throwing-item.json entities/item/variants/throwing-potion.json mod/src/Entities/Item/Adapters pipeline/test/item-subtypes.test.ts
git commit -m "feat(items): extract equipment leaf subtypes"
```

### Task 4: Most-derived item classification

**Files:**

- Create: `mod/src/Entities/Item/ItemVariantClassifier.cs`
- Modify: `mod/src/Entities/Item/ItemExtractor.cs`
- Test: `mod-tests/ItemVariantClassifierTests.cs`

- [ ] **Step 1: Write classifier tests**

Create `mod-tests/ItemVariantClassifierTests.cs`:

```csharp
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemVariantClassifierTests
{
    [Theory]
    [InlineData(typeof(ThrowingPotionData), "throwing-potion")]
    [InlineData(typeof(ThrowingItemData), "throwing-item")]
    [InlineData(typeof(SlateSpellItemData), "slate-spell")]
    [InlineData(typeof(BowItemData), "bow")]
    [InlineData(typeof(MeleeItemData), "melee-weapon")]
    [InlineData(typeof(PrimaryHandItemData), "primary-hand")]
    [InlineData(typeof(HandItemData), "hand-item")]
    [InlineData(typeof(ArrowItemData), "arrow")]
    [InlineData(typeof(ArmorItemData), "armor")]
    [InlineData(typeof(EquipItemData), "equipment")]
    [InlineData(typeof(RepairKitItemData), "repair-kit")]
    [InlineData(typeof(PotionRecipeItemData), "potion-recipe")]
    [InlineData(typeof(LockpickItemData), "lockpick")]
    [InlineData(typeof(CurrencyItemData), "currency")]
    [InlineData(typeof(NoteItemData), "note")]
    [InlineData(typeof(ConsumableItemData), "consumable")]
    [InlineData(typeof(ItemData), "basic")]
    public void ClassifiesConcreteItemTypesBeforeAncestors(Type itemType, string expectedVariant)
    {
        var item = (ItemData)Activator.CreateInstance(itemType)!;

        var classified = ItemVariantClassifier.Classify(item);

        Assert.Equal(expectedVariant, classified.VariantId);
    }
}
```

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemVariantClassifierTests
```

Expected: fails because `ItemVariantClassifier` does not exist.

- [ ] **Step 2: Implement classifier**

Create `mod/src/Entities/Item/ItemVariantClassifier.cs`. The classifier must check concrete leaf types before ancestors in this order:

```csharp
ThrowingPotionData, ThrowingItemData, SlateSpellItemData, BowItemData,
MeleeItemData, PrimaryHandItemData, HandItemData, ArrowItemData,
ArmorItemData, EquipItemData, RepairKitItemData, PotionRecipeItemData,
LockpickItemData, CurrencyItemData, NoteItemData, ConsumableItemData, ItemData
```

Return a small object containing the `VariantId` and an ordered list of adapter extraction functions to merge. Ancestor layers must still be merged for inheritance: e.g. `bow` merges equipment, hand, primary-hand, then bow.

- [ ] **Step 3: Replace inline type ladder**

Modify `ItemExtractor.Walk()` so the existing inline `if/else` variant ladder is replaced by:

1. `var classified = ItemVariantClassifier.Classify(asset);`
2. merge each layer returned by the classifier into `fields`;
3. set `variantId = classified.VariantId`;
4. never emit `ItemDiagnosticCodes.UnsupportedSubtype` for a concrete subclass present in the classifier.

Keep the unsupported diagnostic branch only as a defensive fallback for future game versions.

- [ ] **Step 4: Run classifier and extraction tests**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter "ItemVariantClassifierTests|ItemExtractionServiceTests|EntityPlanCommandTests|EntityExportBatchCommandTests|RunFinalizeCommandTests|ItemDiagnosticCodesTests"
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```sh
git add mod/src/Entities/Item/ItemVariantClassifier.cs mod/src/Entities/Item/ItemExtractor.cs mod-tests/ItemVariantClassifierTests.cs
git commit -m "feat(items): classify item subtypes by concrete type"
```

### Task 5: Pipeline canonicalisation and read-model coverage

**Files:**

- Modify: `pipeline/test/invariants/items.test.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify only if tests expose a real defect: `pipeline/src/entities/item/canonicaliser.ts`, `pipeline/src/stages/emit-read-models.ts`, `pipeline/src/stages/emit-site-metadata.ts`

- [ ] **Step 1: Assert all descriptor variants produce tables**

Extend `pipeline/test/invariants/items.test.ts` so it loads descriptors, emits SQLite, and asserts every `item` variant canonical table exists with at least an `id` column. This protects marker variants and future zero-field variants.

- [ ] **Step 2: Add a subtype fixture row**

Extend the synthetic fixture snapshot with one representative `consumable` row that includes `quickslotCooldownTime` and `statusEffectsJson`. Do not change the fixture's default item names in a way that breaks existing UI smoke assumptions.

- [ ] **Step 3: Assert subtype fields reach detail read models**

Extend `pipeline/test/read-models.test.ts` to assert the `consumable` fixture's `fields_json` contains `quickslotCooldownTime` and `statusEffectsJson` after `emitItemReadModels()`.

- [ ] **Step 4: Run pipeline tests**

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts pipeline/test/invariants/items.test.ts pipeline/test/read-models.test.ts pipeline/test/end-to-end.test.ts
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```sh
git add fixtures/synthetic/snapshot/items.json pipeline/test/invariants/items.test.ts pipeline/test/read-models.test.ts pipeline/src/entities/item/canonicaliser.ts pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-site-metadata.ts
git commit -m "test(items): cover subtype canonicalisation"
```

If none of the pipeline source files changed, leave them out of `git add`.

### Task 6: Live smoke and roadmap closeout

**Files:**

- Modify: `docs/superpowers/roadmap.md`
- Generated locally, not committed: `snapshots/`, `pipeline/dist/data.sqlite`

- [ ] **Step 1: Run local gates**

Run:

```sh
bun run format:check
bun run typecheck
bun test
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
dotnet build mod/ArdenfallCompendium.csproj -c Debug
bun run --cwd site check
```

Expected: every command exits 0.

- [ ] **Step 2: Deploy and run live export**

Deploy the current mod and HotRepl to the CrossOver Ardenfall Demo bottle, launch the game, and run the controller export with wait-for-world enabled. Use the existing deploy and launch command patterns documented in the handoff/current operator notes. Do not commit generated snapshots or SQLite files.

- [ ] **Step 3: Verify subtype diagnostics are eliminated**

Parse the new `diagnostics.json` and assert:

```ts
const unsupported = diagnostics.filter((d) => d.code === "itemSubtypeUnsupported");
if (unsupported.length !== 0) throw new Error(JSON.stringify(unsupported.slice(0, 20), null, 2));
```

Expected: `unsupported.length === 0`.

Do not require `lookupAssetGuidMissing` to be zero; item icons are Slice 3.

- [ ] **Step 4: Update roadmap**

In `docs/superpowers/roadmap.md`, update Slice 2 from active execution to done. Record:

- completion date;
- commit hash range;
- live snapshot path;
- item count;
- diagnostic totals;
- explicit evidence that `itemSubtypeUnsupported` count is zero.

- [ ] **Step 5: Final commit**

```sh
git add docs/superpowers/roadmap.md
git commit -m "docs(roadmap): close item subtype enrichment"
```

If generated files were accidentally staged, unstage them before committing.
