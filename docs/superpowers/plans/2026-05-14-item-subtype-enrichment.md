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

The decompilation-first audit is complete and committed as `docs/superpowers/specs/2026-05-14-item-subtype-audit.md` in `8dc97f6 chore(items): add decompilation audit tooling`. The implementation plan below is reconciled to that audit. Success for the implementation slice means a fresh live smoke has zero current-code `itemSubtypeUnsupported` diagnostics and recovers both currently skipped unsupported items and currently collapsed leaf subtypes.

## Audit-first gate

The audit inspected both sources of truth:

1. **Actual game implementation:** decompiled `mod/libs/Assembly-CSharp.dll` C#/IL. Runtime reflection is forbidden as the source of truth for the audit.
2. **Runtime data:** `snapshots/snapshots/0.0.10.91-20260514-0632448862090/diagnostics.json` and `items.json`.

The committed audit found several plan-critical facts now reflected below:

- `ThrowingPotionData` is a concrete item leaf even though its name does not end in `ItemData`; suffix-only discovery is invalid.
- `ItemData.category` is `Parameter<ItemCategory>` and must be represented as `categoryRef:ref:asset` or explicitly deferred, never as `category:string`.
- `itemAIBehavior` fields are behavior asset references or deferrals, never strings. This Slice 2 plan defers them because no current query or presentation need justifies exposing behavior assets before the asset/presentation slices.
- `LeveledStatusEffect.StackMode` is a structured payload `{ type, addLevel, maxLevel }`.
- Public item names must use game behavior (`GetItemName()` and related getters/properties) where subclasses override raw fields.

Raw decompiled sources and IL are not our code and must not be committed, pasted into docs as method/class bodies, or wired into the public repo through a submodule/subtree. The default storage model is a repo-local `.decompiled/` cache that is gitignored and explicitly verified before commits. A private raw-source repo is allowed only as a last-resort collaboration cache for trusted contributors; it must not be referenced from this public repo or CI. Committed audit notes may contain hashes, commands, identifiers, transformed behavior summaries, field inventories, DTO decisions, and runtime-backed conclusions.

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

Already completed by the audit/tooling commit:

- `.gitignore` — ignores the repo-local decompilation cache.
- `package.json` — exposes `bun run decompile:game`.
- `scripts/decompile-ardenfall.mjs` — reproducible local decompilation command planner/runner.
- `docs/superpowers/specs/2026-05-14-item-subtype-audit.md` — committed transformed audit findings, no raw decompiled source.
- `tooling.test.ts` — regression coverage for decompilation safety and command planning.

Create during implementation:

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
- `mod-tests/ItemAdapterBehaviorTests.cs`
- `pipeline/test/item-subtypes.test.ts`

Modify during implementation:

- `schemas/variant.schema.json` — allow marker variants with zero variant-specific fields.
- `entities/item/entity.json` — add common `ItemData` fields and switch public item name extraction to `GetItemName()`.
- `mod/src/Entities/Item/ItemExtractor.cs` — delegate variant selection and layer extraction to `ItemVariantClassifier`.
- `mod/src/Entities/Item/Adapters/ExtractItem.cs` — emit common fields added to the root descriptor and behavior-derived `name`.
- `pipeline/test/invariants/items.test.ts` — assert descriptor/table coverage for new variants.
- `pipeline/test/read-models.test.ts` — assert detail JSON includes a new subtype field.
- `pipeline/test/load-descriptors.test.ts` — update expected item variant ids/order.
- `pipeline/test/site-metadata.test.ts` — update expected item variant metadata.
- `pipeline/test/snapshot.test.ts` — update fixture row counts and diagnostic totals when root fields change.
- `pipeline/test/canonicaliser.test.ts` — update fixture row/table counts when subtype rows are added.
- `pipeline/test/end-to-end.test.ts` — update overview/detail expectations when subtype rows are added.
- `docs/superpowers/roadmap.md` — record audit reconciliation now; mark Slice 2 done only after live smoke passes.

---

### Task 1: Completed decompilation setup, audit, and reconciliation gate

**Files completed in `8dc97f6 chore(items): add decompilation audit tooling`:**

- Created: `scripts/decompile-ardenfall.mjs`
- Created: `docs/superpowers/specs/2026-05-14-item-subtype-audit.md`
- Modified: `.gitignore`
- Modified: `package.json`
- Added/modified: `tooling.test.ts`

**Files completed by this reconciliation task:**

- Modify: `docs/superpowers/plans/2026-05-14-item-subtype-enrichment.md`
- Modify: `docs/superpowers/roadmap.md`

- [x] **Step 1: Add repo safety guards**

`.gitignore` contains:

```gitignore
# Decompiled third-party game sources (local analysis only; never committed)
.decompiled/
```

Do not add a `.gitmodules` entry or any submodule/subtree for decompiled sources.

- [x] **Step 2: Add reproducible decompile script**

`scripts/decompile-ardenfall.mjs` exists and the root `package.json` exposes:

```json
"decompile:game": "bun run scripts/decompile-ardenfall.mjs"
```

The script writes repo-local output under `.decompiled/<gameVersion>-<sha12>/`, verifies ignored output with `git check-ignore`, emits targeted C#/IL files for audited types, and records command metadata in `meta/manifest.json`.

- [x] **Step 3: Generate local decompiled sources**

Observed command:

```sh
PATH="$HOME/.local/share/ardenfall-compendium/decompile-tools/ilspycmd:$PATH" \
  bun run decompile:game -- \
  --assembly mod/libs/Assembly-CSharp.dll \
  --game-version 0.0.10.91
```

Observed output:

```text
.decompiled/0.0.10.91-63c576261184/
sha256 63c57626118485d98c8f78614fe77f14723ad57e663c4055b8989a8cb82147c3
```

`git check-ignore .decompiled/0.0.10.91-63c576261184` confirmed the generated source cache is ignored.

- [x] **Step 4: Audit game implementation from decompiled sources**

The committed audit covers:

- every concrete item asset type found in the audited assembly, including `ThrowingPotionData`;
- related helper types that are not item assets (`CountedItemData`, `WeightedItemData`, `BaseWeightedItemData`);
- root `ItemData` field decisions;
- subtype field and ancestry decisions;
- behavior-sensitive methods/getters;
- nested payload contracts for status effects, projectile settings, notes, recipes, and spell references.

- [x] **Step 5: Audit runtime evidence**

The audit records the live Slice 1.5 baseline: 899 emitted items, 374 legacy unsupported-subtype diagnostics, and known collapsed leaf samples (`BASE Arrow`, `BASE BOW`, `Base Throwing`, throwing potion template).

- [x] **Step 6: Reconcile the active plan before implementation**

This plan now treats the audit as authoritative. Reconciled deltas:

- `category:string` was replaced by `categoryRef:ref:asset`.
- `itemAIBehavior:string` was removed from Slice 2 descriptor fields and deferred.
- `LeveledStatusEffect.StackMode` uses structured DTO fields `{ type, addLevel, maxLevel }`.
- `ThrowingPotionData` is explicitly covered as a concrete classifier leaf despite lacking the `ItemData` suffix.
- behavior-derived names are required for public `name`, potion recipe names, throwing potion effect/item names, slate spell item names, and secondary spell levels.
- expert review added row-scoped adapter diagnostics, optional-ref absence semantics, guarded invalid recipe names, numeric throwing-potion visual levels, optional empty-area effect names, fixture/test refresh requirements, and explicit live row/leaf recovery assertions.

- [x] **Step 7: Verify no raw decompiled output is staged**

Before any Slice 2 implementation commit, re-run:

```sh
git status --short --ignored .decompiled/0.0.10.91-63c576261184
git diff --cached --name-only
```

Expected: `.decompiled/` appears only as ignored output; no decompiled C#/IL output, DLLs, snapshots, SQLite databases, `.gitmodules`, or generated local caches are staged.

### Task 2: Descriptor foundation and zero-field marker variants

**Files:**

- Modify: `schemas/variant.schema.json`
- Modify: `entities/item/entity.json`
- Modify: `fixtures/synthetic/snapshot/items.json`
- Modify: `fixtures/synthetic/manifest.json`
- Modify: `pipeline/test/load-descriptors.test.ts`
- Modify: `pipeline/test/site-metadata.test.ts`
- Modify: `pipeline/test/snapshot.test.ts`
- Modify: `mod/src/Entities/Item/Adapters/ExtractItem.cs`
- Modify: `mod/src/Entities/Item/ItemExtractor.cs`
- Create: `mod/src/Entities/Item/ItemVariantClassifier.cs`
- Test: `mod-tests/ItemVariantClassifierTests.cs`
- Create: `entities/item/variants/basic.json`
- Create: `entities/item/variants/currency.json`
- Test: `pipeline/test/item-subtypes.test.ts`

- [ ] **Step 1: Write descriptor tests**

Create `pipeline/test/item-subtypes.test.ts` with these tests:

```ts
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { buildDDL } from "$pipeline/sql/ddl";

const ctx = { workspaceRoot: ".", snapshotDir: "", outDir: ".", log: () => undefined };

describe("item subtype descriptors", () => {
  test("loads zero-field marker variants", async () => {
    const loaded = await loadDescriptors.run({}, ctx);
    const variants = loaded.variants.item ?? [];

    expect(variants.find((variant) => variant.variantId === "basic")?.fields).toEqual([]);
    expect(variants.find((variant) => variant.variantId === "currency")?.fields).toEqual([]);
  });

  test("creates canonical tables for marker variants", async () => {
    const loaded = await loadDescriptors.run({}, ctx);
    const db = new Database(":memory:");
    const itemEntity = loaded.entities.item;
    const itemVariants = loaded.variants.item ?? [];
    if (!itemEntity) throw new Error("item descriptor missing");

    db.exec(buildDDL(itemEntity, itemVariants));

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

- [ ] **Step 3: Add common root item fields and behavior-derived name metadata**

In `entities/item/entity.json`, change the existing `name` field source from `itemName.Get()` to `GetItemName()` so subclass overrides drive public names. Keep the field name and type unchanged:

```json
{ "name": "name", "type": "string", "from": "GetItemName()", "missingPolicy": "diagnostic" }
```

Then keep the existing fields and add these root fields after `description`:

```json
{ "name": "stackable", "type": "boolean", "from": "stackable.Get()", "missingPolicy": "diagnostic" },
{ "name": "hideInGui", "type": "boolean", "from": "hideInGUI.Get()", "missingPolicy": "diagnostic" },
{ "name": "questItem", "type": "boolean", "from": "questItem.Get()", "missingPolicy": "diagnostic" },
{ "name": "notLootableChance", "type": "number", "from": "notLootableChance.Get()", "missingPolicy": "diagnostic" },
{ "name": "cannotBeOwned", "type": "boolean", "from": "cannotBeOwned.Get()", "missingPolicy": "diagnostic" },
{ "name": "quickslotIconRef", "type": "ref:asset", "from": "quickslotIcon.Get()", "missingPolicy": "optional-empty" },
{ "name": "categoryRef", "type": "ref:asset", "from": "category.Get()", "missingPolicy": "optional-empty" },
{ "name": "isIllegal", "type": "boolean", "from": "isIllegal.Get()", "missingPolicy": "diagnostic" }
```

Do not add `category:string`; the audited source type is `Parameter<ItemCategory>`. Also add these fields to the `summary` or a new `Flags` detail section only if the generic UI remains readable; otherwise leave the detail sections unchanged and rely on `fields_json` until Slice 4.

Because these fields mostly use `missingPolicy: "diagnostic"`, update every existing row in `fixtures/synthetic/snapshot/items.json` in this same task. Add `stackable`, `hideInGui`, `questItem`, `notLootableChance`, `cannotBeOwned`, `quickslotIconRef`, `categoryRef`, and `isIllegal` to both `fixture-iron-sword` and `fixture-leather-tunic`; use `null` for absent optional refs. Update the `name` provenance source in that fixture from `itemName.Get()` to `GetItemName()`. Update `fixtures/synthetic/manifest.json` with the new `snapshot/items.json` hash. Then update `pipeline/test/snapshot.test.ts` so its exact row-count and diagnostic-count assertions still describe intentional fixture behavior, not missing newly declared fields.

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

- [ ] **Step 4b: Keep descriptors and current exporter support in sync**

Because `basic`/`currency` descriptors and new root fields are visible to validation immediately, implement the matching runtime extraction in this task rather than leaving descriptors ahead of the exporter:

- create `mod/src/Entities/Item/ItemVariantClassifier.cs` with coverage for currently descriptor-backed variants: `MeleeItemData`, `PrimaryHandItemData`, `HandItemData`, `ArmorItemData`, `EquipItemData`, `CurrencyItemData`, and exact `ItemData`;
- add `mod-tests/ItemVariantClassifierTests.cs` using `RuntimeHelpers.GetUninitializedObject(...)` rather than `ScriptableObject.CreateInstance(...)`, because Unity `ScriptableObject` creation is not available in plain `dotnet test`;
- update `ExtractItem.Extract` to emit `GetItemName()` plus every new root field declared above; guard `PotionRecipeItemData` names here because root extraction runs before unsupported subtype branching;
- update `ItemExtractor.Walk()` so `CurrencyItemData` emits `currency` and exact `ItemData` emits `basic` instead of `itemSubtypeUnsupported`.

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemVariantClassifierTests
```

Expected: exits 0.

- [ ] **Step 5: Run descriptor tests**

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: passes.

- [ ] **Step 6: Commit**

```sh
git add schemas/variant.schema.json entities/item/entity.json fixtures/synthetic/snapshot/items.json fixtures/synthetic/manifest.json entities/item/variants/basic.json entities/item/variants/currency.json pipeline/dist/validate-variant.mjs pipeline/test/item-subtypes.test.ts pipeline/test/load-descriptors.test.ts pipeline/test/site-metadata.test.ts pipeline/test/snapshot.test.ts mod/src/Entities/Item/Adapters/ExtractItem.cs mod/src/Entities/Item/ItemExtractor.cs mod/src/Entities/Item/ItemVariantClassifier.cs mod-tests/ItemVariantClassifierTests.cs
git commit -m "feat(items): add base item subtype descriptors"
```

### Task 3: Non-equipment subtype descriptors and adapters

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
- Test: `mod-tests/ItemAdapterBehaviorTests.cs`

- [ ] **Step 1: Extend descriptor tests for unsupported live diagnostic types**

Add this case to `pipeline/test/item-subtypes.test.ts`:

```ts
test("describes every non-equipment subtype found in live diagnostics", async () => {
  const loaded = await loadDescriptors.run({}, ctx);
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

- [ ] **Step 1b: Write non-equipment adapter behavior tests**

Create `mod-tests/ItemAdapterBehaviorTests.cs` with tests that fail until `ItemAdapterHelpers` and the non-equipment adapters exist:

```csharp
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item.Adapters;
using UnityEngine;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemAdapterBehaviorTests
{
    [Fact]
    public void LeveledStatusEffectSnapshotIncludesStructuredStackMode()
    {
        var stackMode = new StatusEffectData.StackMode
        {
            type = StatusEffectData.StackModeType.AddLevel,
            addLevel = 1,
            maxLevel = 5,
        };
        var effect = new LeveledStatusEffect(statusEffect: null, level: 2, lifetime: 30, stackMode);

        var dto = ItemAdapterHelpers.SnapshotLeveledStatusEffect(effect, refs: null, rowId: "fixture");

        Assert.Equal("AddLevel", dto.StackMode?.Type);
        Assert.Equal(1, dto.StackMode?.AddLevel);
        Assert.Equal(5, dto.StackMode?.MaxLevel);
    }

    [Fact]
    public void PotionRecipeSnapshotDoesNotReadRecipeNameWhenInvalid()
    {
        var recipe = ScriptableObject.CreateInstance<PotionRecipe>();

        var dto = ItemAdapterHelpers.SnapshotPotionRecipe(recipe, refs: null, rowId: "fixture");

        Assert.False(dto.IsValid);
        Assert.False(dto.HasDrinkingPotions);
        Assert.False(dto.HasThrowingPotions);
        Assert.Null(dto.RecipeName);
    }
}
```

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemAdapterBehaviorTests
```

Expected: fails because the helper DTOs and methods do not exist yet.

- [ ] **Step 2: Add non-equipment variant descriptors**

Create descriptors with these exact variant ids and fields:

| File                 | Parent  | Fields                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lockpick.json`      | `basic` | `successChance:number` from `successChance.Get()`                                                                                                                                                                                                                                                                                                                                 |
| `consumable.json`    | `basic` | `quickslotCooldownTime:number`, `statusEffectsJson:json`                                                                                                                                                                                                                                                                                                                          |
| `note.json`          | `basic` | `noteTextRef:ref:asset`, `noteText:string`, `noteSectionsJson:json`, `fontRef:ref:asset`, `gainStatRef:ref:asset`, `gainStatCount:integer`                                                                                                                                                                                                                                        |
| `potion-recipe.json` | `basic` | `recipeRef:ref:asset`, `recipeName:string` with `optional-empty`, `isValid:boolean`, `hasDrinkingPotions:boolean`, `hasThrowingPotions:boolean`, `lockedByDefault:boolean`, `enableSkillRequirement:boolean`, `skillRequirement:integer`, `levelModifier:number`, `successModifier:number`, `ingredientsJson:json`, `drinkablePotionRefsJson:json`, `throwingPotionRefsJson:json` |
| `repair-kit.json`    | `basic` | `repairAddAmount:integer`, `repairPercentageAmount:number`, `repairSkillAddAmount:number`, `repairSkillMultAmount:number`                                                                                                                                                                                                                                                         |

Use `canonicalTable` names `item_lockpicks`, `item_consumables`, `item_notes`, `item_potion_recipes`, and `item_repair_kits`. Use positions 20, 30, 40, 50, and 60. Potion-recipe extraction must compute `isValid`, `hasDrinkingPotions`, and `hasThrowingPotions` before reading `PotionRecipe.RecipeName`; emit `recipeName = null` when the recipe is null or invalid. The root `name` for valid potion recipe items must come from `PotionRecipeItemData.GetItemName()`, not a raw item-name field read; invalid recipes must fall back to the raw/base item name instead of throwing.

- [ ] **Step 3: Add adapter helper DTOs**

Create `mod/src/Entities/Item/Adapters/ItemAdapterHelpers.cs` with compact DTO helpers. Include these DTO shapes and do not serialize raw Unity objects:

```csharp
internal sealed record ItemAdapterResult(
    Dictionary<string, object?> Fields,
    Dictionary<string, Provenance> Provenance,
    List<Diagnostic> Diagnostics);
internal sealed record StackModeSnapshot(string? Type, float AddLevel, float MaxLevel);
internal sealed record LeveledStatusEffectSnapshot(object? StatusEffectRef, float Level, float Lifetime, StackModeSnapshot? StackMode);
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

The helper methods should accept `RefResolver refs` and the current row id so nested Unity object references go through a row-scoped resolver helper. For optional refs, return `null` when the source object is absent; when a source object exists but cannot be resolved, emit a row diagnostic and return the missing-ref sentinel so the data loss is visible.

- [ ] **Step 4: Extend common root extraction**

Modify `ExtractItem.Extract` to populate the new root fields. Use a safe behavior-derived name helper: call `GetItemName()` for normal assets, but guard `PotionRecipeItemData` so invalid/null recipes fall back to the base/raw item name instead of throwing. Use `ProvenanceCapture.ForParameter<T>()` for `Parameter<T>` values, and the optional-ref helper for `quickslotIconRef` and `categoryRef`.

- [ ] **Step 5: Add non-equipment adapters**

Create one adapter per non-equipment variant. Each adapter returns `ItemAdapterResult` and only emits fields declared by its descriptor. Drain `refs.Diagnostics` into the result before returning so row-scoped diagnostics stay attached to the current item row.

- [ ] **Step 6: Run mod build**

Run:

```sh
dotnet build mod/ArdenfallCompendium.csproj -c Debug
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemAdapterBehaviorTests
```

Expected: both exit 0.

- [ ] **Step 7: Run descriptor tests**

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts
```

Expected: passes.

- [ ] **Step 8: Commit**

```sh
git add entities/item/variants/lockpick.json entities/item/variants/consumable.json entities/item/variants/note.json entities/item/variants/potion-recipe.json entities/item/variants/repair-kit.json mod/src/Entities/Item/Adapters mod-tests/ItemAdapterBehaviorTests.cs pipeline/test/item-subtypes.test.ts mod/src/Entities/Item/Adapters/ExtractItem.cs
git commit -m "feat(items): extract non-equipment item subtypes"
```

### Task 4: Equipment leaf subtype descriptors and adapters

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
- Test: `mod-tests/ItemAdapterBehaviorTests.cs`

- [ ] **Step 1: Extend descriptor tests for equipment leaves**

Add this case to `pipeline/test/item-subtypes.test.ts`:

```ts
test("describes equipment leaf subtypes before ancestor fallbacks", async () => {
  const loaded = await loadDescriptors.run({}, ctx);
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

| Variant           | Canonical table         | Parent          | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ----------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arrow`           | `item_arrows`           | `equipment`     | `damage:number`, `spawnVisualOnHitStatic:boolean`, `spawnVisualOnHitCharacter:boolean`, `respawnItemPickupChance:number`, `addItemToInventoryChance:number`, `projectileSettingsJson:json`, `projectileRef:ref:asset`                                                                                                                                                                                                                                                                                                                                                |
| `bow`             | `item_bows`             | `primary-hand`  | `itemTypeTooltip:string`, `damage:number`, `bleedMultiplier:number`, `shootStaminaMultiplier:number`, `criticalHitChance:number`, `stunChance:number`, `bleedChance:number`, `critDamageMult:number`, `knockbackStrength:number`, `stealthHitMultiplier:number`, `ammoMassMultiplier:number`, `damageFalloffDistance:number`, `damageFalloff:number`, `durabilityMax:integer`, `projectileSlot:string`, `projectileIconRef:ref:asset`, `aimAnimationSpeedMultiplier:number`, `bleedStatusEffectJson:json`                                                            |
| `slate-spell`     | `item_slate_spells`     | `primary-hand`  | `quickslotSecondaryColorJson:json`, `spellDataJson:json`, `secondarySpellDataJson:json`, `spawnWhenSheathed:boolean`, `spellItemType:string`, `durabilityMax:integer`, `manaCostMultiplier:number`                                                                                                                                                                                                                                                                                                                                                                   |
| `throwing-item`   | `item_throwing_items`   | `primary-hand`  | `itemTypeTooltip:string`, `missileRef:ref:asset`, `missileRotationJson:json`, `damage:number`, `pierceArmor:boolean`, `bleedMultiplier:number`, `damageFalloffDistance:number`, `damageFalloff:number`, `critChance:number`, `stunChance:number`, `bleedChance:number`, `critDamageMult:number`, `quickslotCooldownTime:number`, `bleedStatusEffectJson:json`, `stealthHitMultiplier:number`, `spawnVisualOnHitStatic:boolean`, `spawnVisualOnHitCharacter:boolean`, `respawnItemPickupChance:number`, `addItemToInventoryChance:number`, `missileSettingsJson:json` |
| `throwing-potion` | `item_throwing_potions` | `throwing-item` | `quickslotSecondaryColorJson:json`, `areaOfEffectRange:number`, `areaOfEffectJson:json`, `visualLevel:number`, `effectName:string` with `optional-empty`, `isDrinkingPotion:boolean`                                                                                                                                                                                                                                                                                                                                                                                 |

Use positions 70, 80, 90, 100, and 110. Keep audio/material fields and `itemAIBehavior` out of this slice; asset/audio/rendering and behavior-object presentation are later work.

- [ ] **Step 3: Add equipment leaf adapters**

Extend `mod-tests/ItemAdapterBehaviorTests.cs` before implementation with failing tests for `LeveledSpellData.GetSecondaryLevel()`, `ThrowingPotionData.VisualLevel` preserving non-integer levels, `ThrowingPotionData.GetEffectName()` returning `null` for empty area effects, and color serialization to `quickslotSecondaryColorJson` as `{ r, g, b, a }`. Then create one adapter per leaf type. Use `refs.ResolveAsset` for required/notable Unity object fields, `Enum.ToString()` for enum fields, and compact JSON DTOs for `ProjectileSettings`, `Vector3`, `Color`, `LeveledStatusEffect`, and spell data. Do not use Newtonsoft to serialize game objects directly. `SlateSpellItemData` names must come from `GetItemName()`, `LeveledSpellData` snapshots must include `GetSecondaryLevel()`, `ThrowingPotionData.effectName` must come from `GetEffectName()`, `ThrowingPotionData.visualLevel` must come from `VisualLevel` without integer truncation, and the public root `name` for throwing potions must come from `GetItemName()`.

- [ ] **Step 4: Run mod build and descriptor tests**

Run:

```sh
dotnet build mod/ArdenfallCompendium.csproj -c Debug
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemAdapterBehaviorTests
bun test pipeline/test/item-subtypes.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```sh
git add entities/item/variants/arrow.json entities/item/variants/bow.json entities/item/variants/slate-spell.json entities/item/variants/throwing-item.json entities/item/variants/throwing-potion.json mod/src/Entities/Item/Adapters mod-tests/ItemAdapterBehaviorTests.cs pipeline/test/item-subtypes.test.ts
git commit -m "feat(items): extract equipment leaf subtypes"
```

### Task 5: Most-derived item classification

**Files:**

- Modify: `mod/src/Entities/Item/ItemVariantClassifier.cs`
- Modify: `mod/src/Entities/Item/ItemExtractor.cs`
- Test: `mod-tests/ItemVariantClassifierTests.cs`

- [ ] **Step 1: Extend classifier tests**

Extend the existing `mod-tests/ItemVariantClassifierTests.cs` created in Task 2:

```csharp
using System;
using System.Runtime.CompilerServices;
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
    [InlineData(typeof(ArrowItemData), "arrow")]
    [InlineData(typeof(ArmorItemData), "armor")]
    [InlineData(typeof(PrimaryHandItemData), "primary-hand")]
    [InlineData(typeof(HandItemData), "hand-item")]
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
        var item = (ItemData)RuntimeHelpers.GetUninitializedObject(itemType);

        var classified = ItemVariantClassifier.Classify(item);

        Assert.Equal(expectedVariant, classified.VariantId);
    }
}
```

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter ItemVariantClassifierTests
```

Expected: fails for the subtype cases not implemented yet.

- [ ] **Step 2: Extend classifier**

Modify `mod/src/Entities/Item/ItemVariantClassifier.cs`. The classifier must check concrete leaf types before ancestors in this order:

```csharp
ThrowingPotionData, ThrowingItemData, SlateSpellItemData, BowItemData,
MeleeItemData, ArrowItemData, ArmorItemData, PrimaryHandItemData,
HandItemData, EquipItemData, RepairKitItemData, PotionRecipeItemData,
LockpickItemData, CurrencyItemData, NoteItemData, ConsumableItemData, ItemData
```

Return a small object containing the `VariantId` and an ordered list of adapter extraction functions that each return `ItemAdapterResult`. Ancestor layers must still be merged for inheritance: e.g. `bow` merges equipment, hand, primary-hand, then bow.

- [ ] **Step 3: Replace inline type ladder**

Modify `ItemExtractor.Walk()` so the existing inline `if/else` variant ladder is replaced by:

1. `var classified = ItemVariantClassifier.Classify(asset);`
2. call each adapter layer returned by the classifier;
3. merge each layer's `Fields` into the row fields;
4. merge each layer's `Provenance` into the row provenance;
5. append each layer's drained `Diagnostics` into the current row diagnostics;
6. set `variantId = classified.VariantId`;
7. never emit `ItemDiagnosticCodes.UnsupportedSubtype` for a concrete subclass present in the classifier.

Keep the unsupported diagnostic branch only as a defensive fallback for future game versions. After every layer, assert or enforce that `Refs.Diagnostics` has been drained; row-level resolver diagnostics must not leak into walker diagnostics with `rowId = null`.

- [ ] **Step 4: Run classifier and extraction tests**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter "ItemVariantClassifierTests|ItemAdapterBehaviorTests|ItemExtractionServiceTests|EntityPlanCommandTests|EntityExportBatchCommandTests|RunFinalizeCommandTests|ItemDiagnosticCodesTests"
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```sh
git add mod/src/Entities/Item/ItemVariantClassifier.cs mod/src/Entities/Item/ItemExtractor.cs mod-tests/ItemVariantClassifierTests.cs
git commit -m "feat(items): classify item subtypes by concrete type"
```

### Task 6: Pipeline canonicalisation and read-model coverage

**Files:**

- Modify: `fixtures/synthetic/snapshot/items.json`
- Modify: `pipeline/test/invariants/items.test.ts`
- Modify: `pipeline/test/read-models.test.ts`
- Modify: `pipeline/test/snapshot.test.ts`
- Modify: `pipeline/test/canonicaliser.test.ts`
- Modify: `pipeline/test/end-to-end.test.ts`
- Modify only if tests expose a real defect: `pipeline/src/entities/item/canonicaliser.ts`, `pipeline/src/stages/emit-read-models.ts`, `pipeline/src/stages/emit-site-metadata.ts`

- [ ] **Step 1: Assert all descriptor variants produce tables**

Extend `pipeline/test/invariants/items.test.ts` so it loads descriptors, emits SQLite, and asserts every `item` variant canonical table exists with at least an `id` column. This protects marker variants and future zero-field variants.

- [ ] **Step 2: Add a subtype fixture row**

Extend the synthetic fixture snapshot with one representative `consumable` row that includes all root diagnostic fields plus `quickslotCooldownTime` and `statusEffectsJson`. Do not change the fixture's existing item names in a way that breaks UI smoke assumptions. Because this increases the synthetic item count, update `pipeline/test/snapshot.test.ts`, `pipeline/test/canonicaliser.test.ts`, and `pipeline/test/end-to-end.test.ts` exact count assertions in the same step.

- [ ] **Step 3: Assert subtype fields reach detail read models**

Extend `pipeline/test/read-models.test.ts` to assert the `consumable` fixture's `fields_json` contains `quickslotCooldownTime` and `statusEffectsJson` after `emitItemReadModels()`.

- [ ] **Step 4: Run pipeline tests**

Run:

```sh
bun test pipeline/test/item-subtypes.test.ts pipeline/test/invariants/items.test.ts pipeline/test/read-models.test.ts pipeline/test/snapshot.test.ts pipeline/test/canonicaliser.test.ts pipeline/test/end-to-end.test.ts
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```sh
git add fixtures/synthetic/snapshot/items.json pipeline/test/invariants/items.test.ts pipeline/test/read-models.test.ts pipeline/test/snapshot.test.ts pipeline/test/canonicaliser.test.ts pipeline/test/end-to-end.test.ts pipeline/src/entities/item/canonicaliser.ts pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-site-metadata.ts
git commit -m "test(items): cover subtype canonicalisation"
```

If none of the pipeline source files changed, leave them out of `git add`.

### Task 7: Live smoke and roadmap closeout

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

- [ ] **Step 3: Verify subtype diagnostics, recovered rows, and leaf variants**

Parse the new `diagnostics.json` and `items.json` and assert:

```ts
const unsupported = diagnostics.filter((d) => d.code === "itemSubtypeUnsupported");
if (unsupported.length !== 0) throw new Error(JSON.stringify(unsupported.slice(0, 20), null, 2));

if (manifest.counts.item <= 899) {
  throw new Error(`expected item count above audited baseline 899, got ${manifest.counts.item}`);
}

const byName = new Map(items.rows.map((row) => [row.fields.name, row.variant]));
const expectedLeafVariants = [
  ["BASE Arrow", "arrow"],
  ["BASE BOW", "bow"],
  ["Base Throwing", "throwing-item"],
] as const;
for (const [name, variant] of expectedLeafVariants) {
  if (byName.get(name) !== variant) {
    throw new Error(`${name} expected variant ${variant}, got ${byName.get(name) ?? "<missing>"}`);
  }
}

if (!items.rows.some((row) => row.variant === "throwing-potion")) {
  throw new Error("expected at least one throwing-potion row");
}
```

Expected: `unsupported.length === 0`, item count is greater than 899, audited collapsed samples moved to leaf variants, and at least one throwing potion row exists.

Do not require `lookupAssetGuidMissing` to be zero; item icons are Slice 3.

- [ ] **Step 4: Update roadmap**

In `docs/superpowers/roadmap.md`, update Slice 2 from active execution to done. Record:

- completion date;
- commit hash range;
- live snapshot path;
- item count;
- diagnostic totals;
- explicit evidence that `itemSubtypeUnsupported` count is zero.
- explicit evidence that item count is above the audited baseline of 899;
- explicit evidence that the audited collapsed samples now use leaf variants;

- [ ] **Step 5: Final commit**

```sh
git add docs/superpowers/roadmap.md
git commit -m "docs(roadmap): close item subtype enrichment"
```

If generated files were accidentally staged, unstage them before committing.
