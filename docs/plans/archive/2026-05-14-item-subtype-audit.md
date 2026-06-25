---
title: "Item Subtype Audit"
type: audit
status: implemented
created: 2026-05-14
parent:
superseded_by:
archived: 2026-06-25
---

# Item Subtype Audit

## Sources and hashes

Game version: `0.0.10.91`

Assembly audited:

```text
mod/libs/Assembly-CSharp.dll
sha256 63c57626118485d98c8f78614fe77f14723ad57e663c4055b8989a8cb82147c3
```

Local decompile output, ignored by git:

```text
.decompiled/0.0.10.91-63c576261184/
```

Runtime snapshot audited:

```text
snapshots/snapshots/0.0.10.91-20260514-0632448862090/
```

That snapshot predates the runtime diagnostic-code rename. Its unsupported-subtype diagnostics use `itemSubtypeUnsupportedInSlice1`; current runtime code emits `itemSubtypeUnsupported` through `ItemDiagnosticCodes.UnsupportedSubtype`.

## Decompiler setup

Tooling used:

```text
ilspycmd 10.0.1.8346
ICSharpCode.Decompiler 10.0.1.8346
ikdasm /opt/homebrew/bin/ikdasm
```

Commands:

```sh
mkdir -p "$HOME/.local/share/ardenfall-compendium/decompile-tools/ilspycmd"
dotnet tool update --tool-path "$HOME/.local/share/ardenfall-compendium/decompile-tools/ilspycmd" ilspycmd --version 10.0.1.8346
PATH="$HOME/.local/share/ardenfall-compendium/decompile-tools/ilspycmd:$PATH" \
  bun run decompile:game -- \
  --assembly mod/libs/Assembly-CSharp.dll \
  --game-version 0.0.10.91
```

The first planned pin, `ilspycmd` `10.1.0.8361`, was not available from NuGet. The plan was corrected to `10.0.1.8346` before the successful run.

`git check-ignore .decompiled/0.0.10.91-63c576261184` confirms the generated source cache is ignored. Raw decompiled C#/IL remains local-only and must not be committed.

The decompile script writes:

- full project C# under `.decompiled/0.0.10.91-63c576261184/csharp/`;
- class inventory under `.decompiled/0.0.10.91-63c576261184/meta/classes.txt`;
- targeted C# for every audited item/nested type under `.decompiled/0.0.10.91-63c576261184/types/`;
- targeted IL for behavior-sensitive types under `.decompiled/0.0.10.91-63c576261184/il/`;
- command manifest under `.decompiled/0.0.10.91-63c576261184/meta/manifest.json`.

## Concrete subtype inventory

Decompiled implementation shows these concrete item asset types and inheritance chains:

| Type                   | Base                  | Current extraction issue                                                                               |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| `ItemData`             | `ParameterizedObject` | unsupported exact-root assets are skipped                                                              |
| `CurrencyItemData`     | `ItemData`            | unsupported, skipped                                                                                   |
| `ConsumableItemData`   | `ItemData`            | unsupported, skipped                                                                                   |
| `LockpickItemData`     | `ItemData`            | unsupported, skipped                                                                                   |
| `NoteItemData`         | `ItemData`            | unsupported, skipped                                                                                   |
| `PotionRecipeItemData` | `ItemData`            | unsupported, skipped                                                                                   |
| `RepairKitItemData`    | `ItemData`            | unsupported, skipped                                                                                   |
| `EquipItemData`        | `ItemData`            | supported ancestor variant                                                                             |
| `ArrowItemData`        | `EquipItemData`       | currently collapses to `equipment`                                                                     |
| `HandItemData`         | `EquipItemData`       | supported ancestor variant                                                                             |
| `PrimaryHandItemData`  | `HandItemData`        | supported ancestor variant                                                                             |
| `BowItemData`          | `PrimaryHandItemData` | currently collapses to `primary-hand`                                                                  |
| `SlateSpellItemData`   | `PrimaryHandItemData` | currently collapses to `primary-hand`                                                                  |
| `ThrowingItemData`     | `PrimaryHandItemData` | currently collapses to `primary-hand`                                                                  |
| `ThrowingPotionData`   | `ThrowingItemData`    | currently collapses to `primary-hand`; does not end in `ItemData`, so suffix-based discovery misses it |
| `MeleeItemData`        | `PrimaryHandItemData` | supported leaf variant                                                                                 |
| `ArmorItemData`        | `EquipItemData`       | supported leaf variant                                                                                 |

Related classes whose names contain `ItemData` but are not item asset subtypes:

| Type                   | Role                                       |
| ---------------------- | ------------------------------------------ |
| `CountedItemData`      | serializable item/count/durability payload |
| `WeightedItemData`     | item-list selection payload                |
| `BaseWeightedItemData` | item-list selection base payload           |

## Runtime evidence

Live snapshot manifest:

| Metric                                 | Value |
| -------------------------------------- | ----: |
| emitted item rows                      |   899 |
| fatal diagnostics                      |     0 |
| diagnostic diagnostics                 |  1273 |
| `lookupAssetGuidMissing` diagnostics   |   898 |
| `nullAsset` diagnostics                |     1 |
| legacy unsupported subtype diagnostics |   374 |

Current emitted variant distribution:

| Variant        | Rows |
| -------------- | ---: |
| `primary-hand` |  506 |
| `armor`        |  227 |
| `melee-weapon` |  115 |
| `equipment`    |   51 |

Unsupported runtime diagnostics:

| Runtime type           | Count | Representative ids                                                                                                                    |
| ---------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ItemData`             |   254 | `a9bdf370e746c6046b7519cb702e195d.11400000`, `cc17fb7ee4cc6f1499dde414252e86e9.11400000`, `d89abc408784c1d46811f04676db03a5.11400000` |
| `NoteItemData`         |    65 | `e8f9016eab425434a8f57b7867e5fb77.11400000`, `cec4db18c5c1968449096000c44865b7.11400000`, `8a0be427e8d4b1942a807a9f3cff1127.11400000` |
| `ConsumableItemData`   |    46 | `1c9fe9247eac52344997b9c198af7378.11400000`, `66f59f68558e6f9469d2e4664f417818.11400000`, `9db813aed727a8f4bb3ee4092d9fcdcd.11400000` |
| `CurrencyItemData`     |     4 | `954e5a79655feb64bb6962d5cf556805.11400000`, `43786e52dc7278341a486703828d3fb8.11400000`, `8e8e30e186e60c94997599d5b47318fd.11400000` |
| `LockpickItemData`     |     2 | `dae29d56b2e5e7646b6e0de9f6ddbdd0.11400000`, `c28868241af685d42921d57eda594d24.11400000`                                              |
| `PotionRecipeItemData` |     2 | `8ab1cb14bfdb31f4a9ae70a80e846fdd.11400000`, `d1e2516540e9fbf428c53012454a405d.11400000`                                              |
| `RepairKitItemData`    |     1 | `edd3a821f2a44094287b9f7c5e100827.11400000`                                                                                           |

Runtime examples of leaf subtype collapse:

| Name                              | Current variant | Expected leaf     |
| --------------------------------- | --------------- | ----------------- |
| `BASE Arrow`                      | `equipment`     | `arrow`           |
| `BASE BOW`                        | `primary-hand`  | `bow`             |
| `Base Throwing`                   | `primary-hand`  | `throwing-item`   |
| `Throwing Potion of {lvl} {name}` | `primary-hand`  | `throwing-potion` |

## Root ItemData field decisions

Existing Slice 1 extraction already emits `id`, `name`, `weight`, `value`, `description`, `iconRef`, and tags. Decompiled `ItemData` has additional fields worth deciding now:

| Source member              | Source type                       | Decision             | Planned field / note                                              |
| -------------------------- | --------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `stackable`                | `Parameter<bool>`                 | include              | `stackable:boolean`                                               |
| `hideInGUI`                | `Parameter<bool>`                 | include              | `hideInGui:boolean`                                               |
| `questItem`                | `Parameter<bool>`                 | include              | `questItem:boolean`                                               |
| `notLootableChance`        | `Parameter<float>`                | include              | `notLootableChance:number`                                        |
| `cannotBeOwned`            | `Parameter<bool>`                 | include              | `cannotBeOwned:boolean`                                           |
| `quickslotIcon`            | `Parameter<Sprite>`               | include as asset ref | `quickslotIconRef:ref:asset`, optional-empty                      |
| `category`                 | `Parameter<ItemCategory>`         | include as asset ref | `categoryRef:ref:asset`; the draft plan's `string` field is wrong |
| `isIllegal`                | `Parameter<bool>`                 | include              | `isIllegal:boolean`                                               |
| `pickupMeshList`           | `Parameter<List<GameObject>>`     | defer                | mesh/visual asset extraction belongs with asset/presentation work |
| `inventoryVisualMesh`      | `Parameter<List<GameObject>>`     | defer                | mesh/visual asset extraction belongs with asset/presentation work |
| `inventoryVisualContainer` | `Parameter<GameObject>`           | defer                | mesh/visual asset extraction belongs with asset/presentation work |
| `pickupSounds`             | `Parameter<List<ArdenAudioClip>>` | defer                | audio asset extraction is out of Slice 2                          |

## Per-variant field matrix

This matrix records source-layer decisions. Tasks 2–7 in the active implementation plan must be reconciled against this matrix before coding.

| Variant           | Source type            | Parent variant  | Include now                                                                                                                                       | DTO/ref/defer decisions                                                                                                                                     |
| ----------------- | ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basic`           | `ItemData`             | none            | zero-field marker for exact `ItemData` rows                                                                                                       | root fields live on `items`; marker preserves concrete identity                                                                                             |
| `currency`        | `CurrencyItemData`     | `basic`         | zero-field marker                                                                                                                                 | identity matters; no declared fields                                                                                                                        |
| `consumable`      | `ConsumableItemData`   | `basic`         | `quickslotCooldownTime`, `statusEffectsJson`                                                                                                      | defer `onConsumeSounds`; status effects use compact DTO                                                                                                     |
| `lockpick`        | `LockpickItemData`     | `basic`         | `successChance`                                                                                                                                   | direct numeric field                                                                                                                                        |
| `note`            | `NoteItemData`         | `basic`         | `noteTextRef`, `noteText`, `noteSectionsJson`, `fontRef`, `gainStatRef`, `gainStatCount`                                                          | `notePrefab` deferred; note contents use compact DTO                                                                                                        |
| `potion-recipe`   | `PotionRecipeItemData` | `basic`         | `recipeRef`, `recipeName`, recipe metadata fields                                                                                                 | `PotionRecipeItemData.GetItemName()` is behavior-derived; recipe payload uses compact DTO                                                                   |
| `repair-kit`      | `RepairKitItemData`    | `basic`         | `repairAddAmount`, `repairPercentageAmount`, `repairSkillAddAmount`, `repairSkillMultAmount`                                                      | direct numeric fields                                                                                                                                       |
| `equipment`       | `EquipItemData`        | none            | keep `equipSlot`; consider `useMultipleSlots`, `statTypeRef`, `minimumSkill`, `enchantmentCostMultiplier`                                         | defer audio, enchantment graphs, body object/hook until there is a query/presentation need                                                                  |
| `hand-item`       | `HandItemData`         | `equipment`     | keep `animationSpeedMultiplier`; consider `handMeshRef`                                                                                           | defer particles/hooks/audio                                                                                                                                 |
| `primary-hand`    | `PrimaryHandItemData`  | `hand-item`     | keep `twoHanded`; consider `moveSpeedMult`, `aimMoveSpeedMult`, `attachToRighthand`, `noAnimSwitchForSameHandMesh`                                | defer hand state handler and camera kicks                                                                                                                   |
| `melee-weapon`    | `MeleeItemData`        | `primary-hand`  | current fields plus additional combat stats are candidates                                                                                        | `bleedStatusEffect` compact DTO; `attributeType` ref; `itemAIBehavior`, material/audio/particles/camera-kicks deferred unless Slice 2 expands combat fields |
| `armor`           | `ArmorItemData`        | `equipment`     | current fields plus avatar/foot modifiers are candidates                                                                                          | `clothingAsset` ref; material/audio/voice filters deferred                                                                                                  |
| `arrow`           | `ArrowItemData`        | `equipment`     | `damage`, hit/spawn chances, `projectileSettingsJson`, `projectileRef`                                                                            | `hitMaterialSound` deferred with audio/material handling                                                                                                    |
| `bow`             | `BowItemData`          | `primary-hand`  | combat stats, `projectileSlot`, `projectileIconRef`, `aimAnimationSpeedMultiplier`, `bleedStatusEffectJson`                                       | `itemAIBehavior` is an asset reference or deferral, not a string; audio/camera kicks deferred                                                               |
| `slate-spell`     | `SlateSpellItemData`   | `primary-hand`  | `quickslotSecondaryColor`, `spellDataJson`, `secondarySpellDataJson`, `spawnWhenSheathed`, `spellItemType`, `durabilityMax`, `manaCostMultiplier` | spell data uses compact forward-reference DTO; audio/camera/quick-cast actions deferred                                                                     |
| `throwing-item`   | `ThrowingItemData`     | `primary-hand`  | combat stats, cooldown, hit/spawn chances, `missileRef`, `missileRotationJson`, `missileSettingsJson`, `bleedStatusEffectJson`                    | `itemAIBehavior` is asset ref or deferral; audio/quick throw action deferred                                                                                |
| `throwing-potion` | `ThrowingPotionData`   | `throwing-item` | `quickslotSecondaryColor`, `areaOfEffectRange`, `areaOfEffectJson`, `visualLevel`, `isDrinkingPotion`, derived effect/item names                  | particles/audio deferred                                                                                                                                    |

## Nested DTO contracts

Use bounded DTOs for nested value payloads. Do not serialize raw Unity/Odin/game objects.

### `LeveledStatusEffect`

Source fields/properties: `StatusEffect`, `Level`, `Lifetime`, `StackMode`.

Planned DTO:

| Field             | Source         | Shape                          |
| ----------------- | -------------- | ------------------------------ |
| `statusEffectRef` | `StatusEffect` | asset ref                      |
| `level`           | `Level`        | number                         |
| `lifetime`        | `Lifetime`     | number                         |
| `stackMode`       | `StackMode`    | `{ type, addLevel, maxLevel }` |

`StackMode.type` values are `RefillLifetime`, `AddLifetime`, `AddLevel`, `NoStack`, and `SeparateStack`.

### `ProjectileSettings`

Include scalar/vector gameplay fields: `mass`, `speed`, `radius`, `offset`, `lifetime`, hit-through flags, custom collision radius, fallback offset, bounce/destructible/deflect/knockback/force fields. Asset-like visual effect fields (`destructableOnDamageVisualEffect`, `destructableOnDestroyVisualEffect`, `deflectVisualEffect`, `onDestroyVisualEffect`) should become refs or be deferred with asset work; do not inline effect objects.

### `NoteItem.NoteContents`

`NoteContents` contains `sections`; each `NoteSection` has `textContent`, `imageContent`, and `separator`.

Planned DTO:

| Field         | Source                     | Shape          |
| ------------- | -------------------------- | -------------- |
| `textContent` | `NoteSection.textContent`  | string/null    |
| `imageRef`    | `NoteSection.imageContent` | asset ref/null |
| `separator`   | `NoteSection.separator`    | boolean        |

### `PotionRecipe`

Source fields include `drinkablePotions`, `throwingPotions`, `lockedByDefault`, `enableSkillRequirement`, `skillRequirement`, `levelModifier`, `successModifier`, and `recipe`.

Planned DTO:

| Field                    | Source                                        |
| ------------------------ | --------------------------------------------- |
| `recipeName`             | `RecipeName` property                         |
| `isValid`                | `IsValid` property                            |
| `hasDrinkingPotions`     | `HasDrinkingPotions` property                 |
| `hasThrowingPotions`     | `HasThrowingPotions` property                 |
| `lockedByDefault`        | field                                         |
| `enableSkillRequirement` | field                                         |
| `skillRequirement`       | field                                         |
| `levelModifier`          | field                                         |
| `successModifier`        | field                                         |
| `ingredients`            | list of `{ tagRef, count }` from `RecipeItem` |
| `drinkablePotionRefs`    | refs to `ThrowingPotionData` assets           |
| `throwingPotionRefs`     | refs to `ThrowingPotionData` assets           |

### `LeveledSpellData` and `SpellData.SubSpellData`

`LeveledSpellData` has `spellData`, `level`, and behavior-derived `GetSecondaryLevel()`. The secondary level must be extracted via the method, not by reading private fields. `SpellData.SubSpellData` contains `name` and `effects`; effects are graph-heavy and should not be inlined in Slice 2.

Planned spell DTO:

| Field            | Source                             | Shape                                                                     |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `spellRef`       | `spellData`                        | asset ref                                                                 |
| `spellName`      | `spellData.spellName` when present | string/null                                                               |
| `level`          | `level`                            | number                                                                    |
| `secondaryLevel` | `GetSecondaryLevel()`              | number                                                                    |
| `subSpells`      | `SpellData.subSpells`              | list of `{ name, effectTypeNames }` or defer if effect graph is too noisy |

## Behavior-derived extraction rules

| Behavior                               | Rule                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ItemData.GetItemName()`               | Use for public `name` where subclasses override it; do not blindly read `itemName.Get()` for all variants.                                      |
| `PotionRecipeItemData.GetItemName()`   | Recipe-item names format base item name with `recipe.RecipeName`; extractor must use the method or reproduce this behavior from audited fields. |
| `PotionRecipe.RecipeName`              | Uses first drinkable potion effect name when available, otherwise first throwing potion effect name.                                            |
| `ThrowingPotionData.VisualLevel`       | Uses explicit `visualLevel` when positive, otherwise first area effect level, otherwise zero.                                                   |
| `ThrowingPotionData.GetEffectName()`   | Uses first area effect status-effect name plus romanized visual/effect level.                                                                   |
| `ThrowingPotionData.GetItemName()`     | Replaces `{lvl}` and `{name}` tokens from first area effect and level name.                                                                     |
| `SlateSpellItemData.GetItemName()`     | Replaces `{lvl}` and `{name}` tokens from primary spell data.                                                                                   |
| `LeveledSpellData.GetSecondaryLevel()` | Returns explicit secondary level when enabled, otherwise primary `level`.                                                                       |

## Deferrals

Defer these even when they appear on item classes:

- audio clip lists and material sounds;
- camera kicks;
- mesh/prefab visual extraction not needed for item identity;
- arbitrary Odin/FlowCanvas/spell-effect object graphs;
- quick-cast/quick-throw action graphs;
- generated icon/image/visual-effect asset files, which belong to the asset slice.

## Plan deltas applied

Applied during plan reconciliation after user review:

1. Replaced `category:string` with `categoryRef:ref:asset` in the active implementation plan.
2. Removed `itemAIBehavior:string` from Slice 2 descriptor fields and deferred behavior assets.
3. Added `StackMode` structured DTO fields `{ type, addLevel, maxLevel }` to helper DTO planning.
4. Required classifier coverage for `ThrowingPotionData`, even though it does not end with `ItemData`.
5. Required behavior-derived names for potion recipes, throwing potions, and slate spell items.
6. Recorded full-project decompilation as best-effort in tooling; targeted item decompilation remains the authoritative audit corpus.
7. Added expert-review deltas for row-scoped adapter diagnostics, optional-ref absence semantics, guarded invalid potion recipes, numeric throwing-potion visual levels, optional empty-area effect names, and explicit live row/leaf recovery assertions.

## Implementation acceptance criteria

Implementation is complete only when all of these are true:

- every concrete item asset type listed in this audit has a descriptor-backed variant or an explicit committed deferral;
- classifier tests cover every concrete type, including `ThrowingPotionData`;
- descriptor ancestry tests prove every variant has the right ancestor chain;
- DTO tests cover `LeveledStatusEffect.StackMode`, guarded invalid `PotionRecipe.RecipeName`, `ThrowingPotionData.VisualLevel` as a number, empty-area `ThrowingPotionData.GetEffectName()`, `ThrowingPotionData.GetItemName()`, `SlateSpellItemData.GetItemName()`, and `LeveledSpellData.GetSecondaryLevel()`;
- adapter tests prove nested asset-ref diagnostics remain row-scoped instead of leaking into walker diagnostics;
- pipeline tests prove marker variants with zero fields create canonical tables;
- live export produces zero current-code `itemSubtypeUnsupported` diagnostics;
- live export row count is greater than the audited baseline of 899, because currently skipped unsupported items become emitted rows;
- known collapsed samples move from ancestor variants to leaf variants: `BASE Arrow` -> `arrow`, `BASE BOW` -> `bow`, `Base Throwing` -> `throwing-item`, and `Throwing Potion of {lvl} {name}` -> `throwing-potion` or behavior-derived display name with `throwing-potion` variant.
