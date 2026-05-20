# Ardenfall Item Asset Inventory & Tooltip-Parity Gap Report

**Status:** audit
**Date:** 2026-05-20
**Patch anchor:** `0.0.10.91-63c576261184`
**Referenced by:** `docs/superpowers/specs/2026-05-20-items-presentation-closure-design.md`
**Companion documents:**

- `docs/superpowers/specs/2026-05-20-compendium-architecture-survey.md`
- `docs/superpowers/specs/2026-05-20-items-presentation-closure-architecture-review.md`

---

Source-grounded inventory of every typed datum reachable from an Ardenfall item asset, the in-game tooltip composer chain that consumes it, and a per-asset-type cross-reference of currently-extracted vs. missing fields against the mod's Item adapters. The report below is the deliverable; section 7 is the gap matrix that justifies Slice 4 follow-up.

---

# Ardenfall Item Asset Inventory & Tooltip-Parity Gap Report

All decompiled C# paths are rooted at `.decompiled/0.0.10.91-63c576261184/csharp/Ardenfall/`. `Parameter<T>` and `SmartListParameter<T>` wrap a `T` (or `List<T>`) reachable via `Get()` (`Parameter.cs:77-79,159` and `SmartListParameter.cs:50-69`); inherited values are pulled from the parent chain (`ParameterizedObject.cs:160-167`). `LeveledSpellDataParameter : Parameter<LeveledSpellData>` (`Item/LeveledSpellDataParameter.cs:6`) and `ItemSlotTypeListParameter : Parameter<List<ItemSlotType>>` (`Item/ItemSlotTypeListParameter.cs:6`).

## 1. Per-item-subclass outbound graph

### 1.1 `ItemData` (root) — `Item/ItemData.cs`

Concrete asset fields (line numbers point at the declaration; all are `Parameter<T>`):

- `itemName: string` — `Item/ItemData.cs:11`. UI title source (`itemName.Get()` → `GetItemName` at `Item/ItemData.cs:99`).
- `description: string` — `Item/ItemData.cs:13`. UI description source via `BaseItem.GetTooltipDescription` (`Item/BaseItem.cs:166`).
- `stackable: bool` — `:15`. Tooltip state-fact.
- `hideInGUI: bool` — `:17`. Drops the item out of inventory (`Item/BaseItem.cs:130`).
- `questItem: bool` — `:19`. Blocks removal for the player only (`Item/BaseItem.cs:106-110`).
- `notLootableChance: float` — `:21`. Used by `RandomizeLootability` (`Item/BaseItem.cs:75-79`).
- `cannotBeOwned: bool` — `:23`. Blocks `isStolen` (`Item/BaseItem.cs:84`).
- `pickupMeshList: List<GameObject>` — `:25`. Pickup prefab list (visual only).
- `inventoryVisualMesh: List<GameObject>` — `:27` and `inventoryVisualContainer: GameObject` — `:29`. Inventory mesh (visual only).
- `icon: Sprite` — `:31`. Tooltip / list icon (`Item/BaseItem.cs:179`).
- `quickslotIcon: Sprite` — `:33`. Quickslot UI icon.
- `category: ItemCategory` — `:35` → references `ItemCategory.cs` (asset). Tooltip default icon + tint (`Item/BaseItem.cs:182`, `Item/BaseItem.cs:188`).
- `tags: SmartListParameter<ItemTag>` — `:38` → list of `ItemTag.cs:6` assets. Tooltip's tag block (`Item/BaseItem.cs:139-153`).
- `isIllegal: bool` — `:40`. Used by `ItemCategory.CategoryColumn.ApplyIllegal` (`ItemCategory.cs:75-86`).
- `moneyValue: int` — `:42`. Tooltip value source (`Item/BaseItem.cs:157`).
- `weight: float` — `:44`. Tooltip weight source (`Item/BaseItem.cs:161`).
- `pickupSounds: List<ArdenAudioClip>` — `:46`. Audio only.

Outbound asset refs reachable from `ItemData`: `Sprite icon`, `Sprite quickslotIcon`, `ItemCategory category`, `ItemTag[] tags`, `ArdenAudioClip[] pickupSounds`, plus `GameObject` prefab lists (no tooltip impact).

### 1.2 `EquipItemData` extends `ItemData` — `Item/EquipItemData.cs`

New fields:

- `enchantmentCostMultiplier: float` — `:11`. Crafting only.
- `onEquipSound: List<ArdenAudioClip>` — `:13`. Audio only.
- `useMultipleSlots: bool` — `:16`. Slot-fill semantics.
- `usableSlots: ItemSlotTypeListParameter` (i.e. `Parameter<List<ItemSlotType>>`) — `:18`. UI slot caption.
- `enchantments: LeveledEnchantmentData[]` — `:20`. **Outbound ref array** to `EnchantmentData` via each element's `.enchantment` (`Item/LeveledEnchantmentData.cs:7`).
- `builtInEnchantments: SmartListParameter<LeveledEnchantmentData>` — `:23`. Same outbound shape.
- `additionalBodyObject: GameObject` — `:25` / `additionalBodyHook: ItemHook` — `:27`. Visual only.
- `statType: StatType` — `:29`. Drives skill requirement (`Item/EquipItem.cs:329-335`).
- `minimumSkill: int` — `:31`. Tooltip skill gate (`UI/ItemInfoListUI.cs:226-239`).

Referenced asset types for tooltips: `EnchantmentData` (via `LeveledEnchantmentData`), `StatType` (`StatType.cs:6`), `ItemSlotType` enum (`Item/ItemSlotType.cs:5`).

Enchantments on an item are _not baked into the asset state_ — `EquipItem.CreateState` builds initial `EnchantmentState` rows from `itemData.enchantments` + `itemData.builtInEnchantments` and stores them on the runtime `EquipItemState` (`Item/EquipItem.cs:91-99`, `:161-181`). Therefore for the static compendium, the only enchantment data ever present on an asset is the union of those two parameter lists.

### 1.3 `HandItemData : EquipItemData` — `Item/HandItemData.cs`

- `handMesh: GameObject` — `:10`. Visual.
- `animationSpeedMultiplier: float` — `:12`. Anim only; **leaks into no tooltip composer**.
- `critialHitParticles: GameObject` — `:14`. Visual.
- `sheathHook: ItemHook` — `:16`. Visual.
- `sheathSounds`, `unsheathSounds: List<ArdenAudioClip>` — `:18`, `:20`. Audio.
- `sheathedShuffleSounds: ArdenAudioClipList` — `:22`. Audio.

`HandItemData` contributes nothing to a tooltip — it's animation + audio plumbing.

### 1.4 `PrimaryHandItemData : HandItemData` — `Item/PrimaryHandItemData.cs`

- `moveSpeedMult: float` — `:10`. Runtime modifier.
- `aimMoveSpeedMult: float` — `:12`. Runtime modifier.
- `handStateHander: ItemHandStateHandler` — `:14`. State machine plumbing.
- `twoHanded: bool` — `:16`. Slot semantics; not tooltip-displayed directly but used by extraction.
- `attachToRighthand`, `noAnimSwitchForSameHandMesh: bool` — `:18`, `:20`. Anim plumbing.
- `sheathCameraKick`, `unSheathCameraKick: CameraRotateKick` — `:22`, `:24`. FX only.

`PrimaryHandItemData` contributes nothing to tooltip rendering directly; its derived classes do.

### 1.5 `MeleeItemData : PrimaryHandItemData` — `Item/MeleeItemData.cs`

- `damage: float` — `:11`. Tooltip primary damage row (`Item/MeleeItem.cs:521-527`).
- `criticalHitChance: float` — `:13`.
- `stunChance: float` — `:15`.
- `bleedChance: float` — `:17`.
- `pierceChance: float` — `:19`.
- `stealthStunChance: float` — `:21`.
- `critDamageMult: float` — `:23`.
- `knockbackStrength`, `knockbackStrengthHard: float` — `:25`, `:27`.
- `stealthHitMultiplier: float` — `:29`.
- `bleedStatusEffect: LeveledStatusEffect` — `:31` → outbound ref to `StatusEffectData` (`LeveledStatusEffect.cs:8-19`).
- `bleedMultiplier: float` — `:33`.
- `hardAttackDamMult: float` — `:35`. **Tooltip 'Heavy Attack Damage' row** (`Item/MeleeItem.cs:524`).
- `attributeType: StatType` — `:37`. Drives `ItemAttributeId` (`Item/MeleeItem.cs:56`).
- `durabilityMax: int` — `:39`. Tooltip durability bar (`UI/ItemInfoListUI.cs:255-279`).
- `hardAttackStaminaMultiplier`, `quickAttackStaminaMultiplier: float` — `:41`, `:43`.
- `blockStaminaMultiplier`, `parryStaminaMultiplier: float` — `:45`, `:47`.
- `onAttackSounds`, `onDurabilityBreakSounds: List<ArdenAudioClip>` — `:49`, `:51`. Audio.
- `attackStartCameraKicks`, `attackStartHardCameraKicks: List<CameraRotateKick>` — `:53`, `:55`.
- `attackHitCameraKick`, `attackHitHardCameraKick`, `parryCameraKick`, `blockCameraKick`, `stunCameraKick: CameraRotateKick` — `:57-65`. FX.
- `canBeParried`, `canParry`, `canBlock`, `aiAlwaysTryToBlock: bool` — `:67-73`. Combat semantics; `canBlock` and `canParry` are exposed via item behaviour, not the tooltip text.
- `itemAIBehavior: MeleeItemAIBehavior` — `:75`. AI only.
- `hitMaterialSound: MaterialSound` — `:77`. Audio.
- `bloodParticles: GameObject` — `:79`. FX.
- `hitStopTime: float` — `:81`.

### 1.6 `ArmorItemData : EquipItemData` — `Item/ArmorItemData.cs`

- `armorRating: float` — `:11`. Tooltip 'Damage Threshold' row (`Item/ArmorItem.cs:115-120`).
- `durabilityMax: int` — `:13`.
- `onlyEquipIfMatchesAvatar: bool` — `:15`. CanEquip filter.
- `clothingAsset: ClothingAsset` — `:17`. Mesh / avatar reference.
- `armAnimationOffset: float` — `:19`. Anim.
- `materialSound`, `materialSoundWet: MaterialSound` — `:21`, `:23`. Audio.
- `armorShuffleSounds: ArdenAudioClipList` — `:25`. Audio.
- `attachVoiceFilters: SmartListParameter<ArdenAudioFilter>` — `:28`. Audio.
- `onDurabilityBreakSounds: List<ArdenAudioClip>` — `:30`. Audio.
- `feetOffGroundModifier`, `feetRotationModifier: float` — `:32`, `:34`. Avatar plumbing.

Note: `ArmorItem.GetTooltipItemType` returns `itemData.statType.Get()?.statName` (`Item/ArmorItem.cs:71-74`), so a `StatType` ref from `EquipItemData.statType` is required.

### 1.7 `BowItemData : PrimaryHandItemData` — `Item/BowItemData.cs`

- `itemTypeTooltip: string` — `:10`. **Direct tooltip type-line override** (`Item/BowItem.cs:202-205`).
- `damage: float` — `:12`. Tooltip damage row (`Item/BowItem.cs:430-435`).
- `bleedMultiplier`, `shootStaminaMultiplier`, `criticalHitChance`, `stunChance`, `bleedChance`, `critDamageMult`, `knockbackStrength`, `stealthHitMultiplier`, `ammoMassMultiplier`, `damageFalloffDistance`, `damageFalloff: float` — `:14-34`. Combat math; only `damage` is rendered as a primary tooltip row.
- `durabilityMax: int` — `:36`.
- `onAttackSound`, `additionalOnAttackSound`, `aimSound`, `onDurabilityBreakSounds: List<ArdenAudioClip>` — `:38-44`. Audio.
- `projectileSlot: ItemSlotType` — `:46`. Drives ammo lookup.
- `projectileIcon: Sprite` — `:48`. Fallback HUD icon (`Item/BowItem.cs:74`).
- `aimAnimationSpeedMultiplier: float` — `:50`.
- `bleedStatusEffect: LeveledStatusEffect` — `:52` → `StatusEffectData` ref.
- `itemAIBehavior: RangedItemAIBehavior` — `:54`.
- `shootCameraKick`, `aimCameraKick: CameraRotateKick` — `:56`, `:58`.
- `aimCameraKickWait: float` — `:60`.

### 1.8 `ArrowItemData : EquipItemData` — `Item/ArrowItemData.cs`

- `damage: float` — `:11`. Tooltip damage row (`Item/ArrowItem.cs:145-150`).
- `spawnVisualOnHitStatic`, `spawnVisualOnHitCharacter: bool` — `:13`, `:15`.
- `respawnItemPickupChance`, `addItemToInventoryChance: float` — `:17`, `:19`.
- `projectileSettings: ProjectileSettings` — `:21`. Physics asset.
- `projectilePrefab: GameObject` — `:23`. Visual.
- `hitMaterialSound: MaterialSound` — `:25`. Audio.

`ArrowItem.GetTooltipItemType` returns the constant string `"Arrow"` (`Item/ArrowItem.cs:52-55`); no `statType` field involved.

### 1.9 `ThrowingItemData : PrimaryHandItemData` — `Item/ThrowingItemData.cs`

- `itemTypeTooltip: string` — `:9`. Type-line override (`Item/ThrowingItem.cs:195-198`).
- `missilePrefab: GameObject` — `:11`. Visual.
- `missileRotation: Vector3` — `:13`.
- `damage: float` — `:15`. Tooltip damage row (`Item/ThrowingItem.cs:187-192`).
- `pierceArmor: bool` — `:17`.
- `bleedMultiplier: float` — `:19`.
- `damageFalloffDistance`, `damageFalloff: float` — `:21`, `:23`.
- `critChance`, `stunChance`, `bleedChance`, `critDamageMult: float` — `:25-31`.
- `quickslotCooldownTime: float` — `:33`.
- `bleedStatusEffect: LeveledStatusEffect` — `:35` → `StatusEffectData` ref.
- `stealthHitMultiplier: float` — `:37`.
- `spawnVisualOnHitStatic`, `spawnVisualOnHitCharacter: bool` — `:39`, `:41`.
- `respawnItemPickupChance`, `addItemToInventoryChance: float` — `:43`, `:45`.
- `missileSettings: ProjectileSettings` — `:47`.
- `onShootSounds`, `onHitSounds: List<ArdenAudioClip>` — `:49`, `:51`. Audio.
- `itemAIBehavior: RangedItemAIBehavior` — `:53`.
- `quickThrowAction: QuickThrowAction` — `:55`.

### 1.10 `ThrowingPotionData : ThrowingItemData` — `Item/ThrowingPotionData.cs`

- `quickslotSecondaryColor: Color` — `:9`. HUD tint.
- `onDrinkSounds`, `onEffectSounds: List<ArdenAudioClip>` — `:11`, `:13`. Audio.
- `areaOfEffectParticles`, `singleEffectParticles: GameObject` — `:15`, `:17`. FX.
- `areaOfEffectRange: float` — `:19`.
- `areaOfEffect: LeveledStatusEffect[]` — `:21` → array of refs to `StatusEffectData` via `[i].StatusEffect`. **Drives all tooltip text** (`Item/ThrowingPotion.cs:160-178`).
- `visualLevel: int` — `:23`.
- `isDrinkingPotion: bool` — `:26`. Tooltip state-fact (drives the `<b>On Drink:</b>` vs `<b>On Hit:</b>` heading at `Item/ThrowingPotion.cs:172`).
- Computed: `VisualLevel` (`:30-43`), `GetEffectName()` (`:51-60`), `GetItemName()` (`:62-71`) — concatenate `statusEffectName + roman(level)` against the first `areaOfEffect` entry; `itemName` is treated as a `{lvl}/{name}` template.

### 1.11 `SlateSpellItemData : PrimaryHandItemData` — `Item/SlateSpellItemData.cs`

- `quickslotSecondaryColor: Color` — `:10`. HUD tint.
- `spellData: LeveledSpellDataParameter (= Parameter<LeveledSpellData>)` — `:12`. **Source of name, icon, mana cost, tooltip, type-line** (`Item/SlateSpellItem.cs:179-209`, `:211-234`, `:283-286`, `:236-241`).
- `secondarySpellData: LeveledSpellDataParameter` — `:14`. Optional secondary effect tooltip (`Item/SlateSpellItem.cs:223-233`).
- `spawnWhenSheathed: bool` — `:16`.
- `spellItemType: SpellItemType` — `:18` (enum `Slate|Scroll|Stave` at `Item/SpellItemType.cs:5`). **Tooltip suffix in `GetTooltipItemType`** (`Item/SlateSpellItem.cs:283-286`).
- `durabilityMax: int` — `:20`.
- `manaCostMultiplier: float` — `:22`. Used by `GetManaCost` (`Item/SlateSpellItem.cs:413-419`) and rendered via `GetItemStatInfos` as the 'Mana Usage' row (`Item/SlateSpellItem.cs:236-241`).
- `onDurabilityBreakSounds: List<ArdenAudioClip>` — `:24`. Audio.
- `castCameraKick`, `castSecondaryCameraKick`, `castHardCameraKick`, `aimCameraKick: CameraRotateKick` — `:26-32`. FX.
- `aimCameraKickWait: float` — `:34`.
- `quickCastAction: QuickCastSpellAction` — `:36`.
- Computed: `GetItemName()` (`:44-54`) overrides parent: replaces `{lvl}` with `ItemLevelNames.TryGetName(level)` and `{name}` with `spellData.spellName`.

### 1.12 `ConsumableItemData : ItemData` — `Item/ConsumableItemData.cs`

- `quickslotCooldownTime: float` — `:10`.
- `statusEffects: LeveledStatusEffect[]` — `:12` → array of refs to `StatusEffectData` via each `[i].StatusEffect`. **Drives `On Consume` tooltip block** (`Item/ConsumableItem.cs:79-101`).
- `onConsumeSounds: List<ArdenAudioClip>` — `:14`. Audio.

### 1.13 `NoteItemData : ItemData` — `Item/NoteItemData.cs`

- `noteTextContents: TextAsset` — `:10`. Legacy free-form text.
- `noteContents: NoteItem.NoteContents` — `:12`. Structured book sections (see §6).
- `notePrefab: GameObject` — `:14`. Visual.
- `fontAsset: NoteFontAsset` — `:16`.
- `gainStat: StatType` — `:18`. Stat-book gain target.
- `gainStatCount: int` — `:20`. Stat-book gain amount; used by `NoteItem.OnFullReadBook` to push +N into the player's stat (`Item/NoteItem.cs:71-77`).

`NoteItem` has no overrides for `GetEffectsTooltip` / `GetTooltipItemType` / `GetItemStatInfos`. Its 'effects' surface is the read-book UX only.

### 1.14 `PotionRecipeItemData : ItemData` — `Item/PotionRecipeItemData.cs`

- `recipe: PotionRecipe` — `:9`. **Outbound ref** to `PotionRecipe.cs:8` asset. Source of `recipe.RecipeName` (`PotionRecipe.cs:32-39`), drives `GetItemName` substitution (`Item/PotionRecipeItemData.cs:11-18`) and `PotionRecipeItem.GetTooltipDescription` (`Item/PotionRecipeItem.cs:21-29`).

### 1.15 `RepairKitItemData : ItemData` — `Item/RepairKitItemData.cs`

- `repairAddAmount: int` — `:9`.
- `repairPercentageAmount: float` — `:11`.
- `repairSkillAddAmount: float` — `:13`.
- `repairSkillMultAmount: float` — `:15`.

`RepairKitItem` has no tooltip overrides; only `GetInputs` adds a 'Repair Items' button (`Item/RepairKitItem.cs:21-27`).

### 1.16 `LockpickItemData : ItemData` — `Item/LockpickItemData.cs`

- `successChance: float` — `:9`.

`LockpickItem` has zero tooltip overrides (`Item/LockpickItem.cs:5`); contributes nothing new to tooltip rendering — say so explicitly.

### 1.17 `CurrencyItemData : ItemData` — `Item/CurrencyItemData.cs`

No new fields (`:7-11`). `CurrencyItem` has no overrides (`Item/CurrencyItem.cs:3`). Contributes nothing new to tooltip rendering.

---

## 2. Composer methods

Five virtual methods drive the tooltip surface from the `BaseItem` hierarchy. The in-game caller is `UI/ItemInfoListUI.SetBasicStuff` (`UI/ItemInfoListUI.cs:213-247`) + `UI/ItemInfoListUI.UpdateStatValues` (`UI/ItemInfoListUI.cs:370-396`). Inputs flagged 'R' below are **runtime / player / world singleton** and are not present on the static asset.

### 2.1 `GetFullItemName()`

| Subclass           | File:line                        | Inputs                                                                                                                          | Asset-only?                                         |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `BaseItem`         | `Item/BaseItem.cs:174-177`       | `itemData.itemName.Get()`                                                                                                       | yes                                                 |
| `EquipItem`        | `Item/EquipItem.cs:428-435`      | `itemData.itemName.Get()`                                                                                                       | yes                                                 |
| `ArmorItem`        | `Item/ArmorItem.cs:66-69`        | parent + `durability` (R) via `DurabilityUtility.TryModifyNameDurability` (`Item/DurabilityUtility.cs:23-31`)                   | base name yes; `(Ruined)` suffix needs R durability |
| `MeleeItem`        | `Item/MeleeItem.cs:102-105`      | same pattern                                                                                                                    | same                                                |
| `BowItem`          | `Item/BowItem.cs:197-200`        | same pattern                                                                                                                    | same                                                |
| `SlateSpellItem`   | `Item/SlateSpellItem.cs:179-190` | `itemData.itemName.Get()` + `LeveledSpellData.spellData.spellName` + `ItemLevelNames.TryGetName(level)` + durability suffix (R) | name itself = yes; suffix needs R                   |
| `ThrowingPotion`   | `Item/ThrowingPotion.cs:116-127` | `itemData.itemName.Get()` + first `areaOfEffect[0].StatusEffect.statusEffectName` + visualLevel                                 | yes                                                 |
| `PotionRecipeItem` | `Item/PotionRecipeItem.cs:11-18` | `itemData.GetItemName()` + `WorldSingleton<PotionRecipeManager>.IsRecipeUnlocked(recipe)` (R) → appends `(Learned)`             | name yes; learned-suffix needs R singleton          |

`ItemData` itself overrides `GetItemName` for three subtypes:

- `PotionRecipeItemData.GetItemName` (`Item/PotionRecipeItemData.cs:11-18`) — `string.Format(base.GetItemName(), recipe.Get().RecipeName)`.
- `SlateSpellItemData.GetItemName` (`Item/SlateSpellItemData.cs:43-54`) — `{lvl}/{name}` template substitution.
- `ThrowingPotionData.GetItemName` (`Item/ThrowingPotionData.cs:62-71`) — same template.

### 2.2 `GetTooltipDescription()`

| Subclass           | File:line                        | Inputs                                                                                                                           | Asset-only?                                                                                                                                                                     |
| ------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseItem`         | `Item/BaseItem.cs:166-169`       | `itemData.description.Get()`                                                                                                     | yes                                                                                                                                                                             |
| `PotionRecipeItem` | `Item/PotionRecipeItem.cs:21-29` | base description + `WorldSingleton<PotionRecipeManager>.Instance.potionRecipeDescription` (R) formatted with `recipe.RecipeName` | needs R singleton string but recipe name is asset-derivable; format string `potionRecipeDescription` lives on `PotionRecipeManager` (R singleton; not on `ArdenfallMasterData`) |

No other subclass overrides `GetTooltipDescription`.

### 2.3 `GetTooltipItemType()`

| Subclass         | File:line                        | Inputs                                                                                                      | Asset-only? |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ------- | --- |
| `BaseItem`       | `Item/BaseItem.cs:163-165`       | returns `null`                                                                                              | yes         |
| `ArmorItem`      | `Item/ArmorItem.cs:71-74`        | `itemData.statType.Get()?.statName`                                                                         | yes         |
| `MeleeItem`      | `Item/MeleeItem.cs:516-519`      | `itemData.statType.Value.statName` (note: uses `EquipItemData.statType`, NOT `MeleeItemData.attributeType`) | yes         |
| `BowItem`        | `Item/BowItem.cs:202-205`        | `itemData.itemTypeTooltip.Get()`                                                                            | yes         |
| `ArrowItem`      | `Item/ArrowItem.cs:52-55`        | constant `"Arrow"`                                                                                          | yes         |
| `ThrowingItem`   | `Item/ThrowingItem.cs:195-198`   | `itemData.itemTypeTooltip.Get()`                                                                            | yes         |
| `SlateSpellItem` | `Item/SlateSpellItem.cs:283-286` | `itemData.spellData.Get().spellData.statType.statName` + suffix string from `spellItemType` (`Slate         | Scroll      | Stave`) | yes |

### 2.4 `GetEffectsTooltip()`

This is the most player-state-light composer; the substrate work happens inside `StatusEffectData.GetTooltip` and friends.
| Subclass | File:line | Inputs | Asset-only? |
|---|---|---|---|
| `BaseItem` | `Item/BaseItem.cs:139-153` | iterates `itemData.tags.Get()` and emits `tagName: description` per tag | yes |
| `EquipItem` | `Item/EquipItem.cs:437-456` | base + `foreach enchantmentState in enchantmentStates: data.GetTooltip(baseLevel, itemData)` (`Item/EnchantmentData.cs:54-79`). Hidden / `hideEffectTooltips` enchantments are skipped. | yes — initial `enchantmentStates` are built deterministically from `itemData.enchantments` + `itemData.builtInEnchantments` in `InitializeStaticEnchantments` (`Item/EquipItem.cs:161-181`); the runtime `AddEnchantment`/`RemoveEnchantment` paths can mutate state but for a fresh asset they reflect only the asset arrays. |
| `ConsumableItem` | `Item/ConsumableItem.cs:79-101` | base + each `statusEffects[i].StatusEffect.GetTooltip(level, lifetime, targetSelf=true)` joined via `StatusEffectUtil.CombineEffectTooltips` (`StatusEffectUtil.cs:175-191`), prefixed `<b>On Consume:</b>` | yes |
| `ThrowingPotion` | `Item/ThrowingPotion.cs:160-180` | base + each `areaOfEffect[i].StatusEffect.GetTooltip(level, lifetime, targetSelf=isDrinkingPotion)`, prefix `<b>On Drink:</b>` vs `<b>On Hit:</b>` | yes |
| `SlateSpellItem` | `Item/SlateSpellItem.cs:211-234` | base + `spellData.spellData.GetTooltip(SpellInputMode.Primary, level, secondaryLevel)` + `secondarySpellData.spellData.GetTooltip(SpellInputMode.Secondary, ...)` | yes (see §4 for SpellData.GetTooltip details) |

### 2.5 `GetItemStatInfos()`

| Subclass         | File:line                        | Rows emitted                                                                                      | Inputs needed                                                                                                                                                                                                                                                                |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BaseItem`       | `Item/BaseItem.cs:194-197`       | empty list                                                                                        | —                                                                                                                                                                                                                                                                            |
| `ArmorItem`      | `Item/ArmorItem.cs:115-122`      | `Damage Threshold` = `armorRating.Get()` (large text)                                             | asset                                                                                                                                                                                                                                                                        |
| `MeleeItem`      | `Item/MeleeItem.cs:521-530`      | `Damage` = `damage.Get()`, `Heavy Attack Damage` = `damage * hardAttackDamMult` (both large text) | asset                                                                                                                                                                                                                                                                        |
| `BowItem`        | `Item/BowItem.cs:430-435`        | `Damage` = `damage.Get()` (large text)                                                            | asset                                                                                                                                                                                                                                                                        |
| `ArrowItem`      | `Item/ArrowItem.cs:145-150`      | `Damage` = `damage.Get()` (large text)                                                            | asset                                                                                                                                                                                                                                                                        |
| `ThrowingItem`   | `Item/ThrowingItem.cs:187-192`   | `Damage` = `damage.Get()` (large text)                                                            | asset                                                                                                                                                                                                                                                                        |
| `ThrowingPotion` | `Item/ThrowingPotion.cs:155-158` | empty list                                                                                        | —                                                                                                                                                                                                                                                                            |
| `SlateSpellItem` | `Item/SlateSpellItem.cs:236-241` | `Mana Usage` = `GetManaCost()` (large text)                                                       | **R**: `GetManaCost` reads `spellData.spellData.manaCost` (asset) and applies `manaCostMultiplier` (asset). It then calls `StatCalculations.CalculateManaCost(level, manaCost, manaCostMultiplier)` (`Item/SlateSpellItem.cs:413-419`) which is asset-only too. ✓ asset-only |

`ItemStatInfo.GetComparisonTooltip` (`Item/ItemStatInfo.cs:72-81`) computes a delta against `ItemStatInfo.GetComparingItem` which dereferences `currentItem.Character.equippedItems.GetItem(slot)` (`Item/ItemStatInfo.cs:42-52`). For the static compendium this returns null and the comparison value is 0 (`Item/ItemStatInfo.cs:54-62`); only `value`, `statName`, `suffix`, `isLargeText`, `indent` are deterministic — `relativeValue` and `originalValue` require an equipped item (R).

The `ItemInfoListUI` post-processing layer additionally consumes asset-only data: `GetFullItemWeight` (`Item/BaseItem.cs:160-162`), `GetFullItemMoneyValue` (`Item/BaseItem.cs:157-159` + `Item/EquipItem.cs:184-191` durability scaling that needs R durability), `GetMinimumStat` (`Item/EquipItem.cs:336-345`, `Item/SlateSpellItem.cs:301-313` — both reduce to `(statType.id, minimumSkill)` for the asset). For armor/melee/bow/spell items, the min-skill row also needs the player's current stat for color coding (`UI/ItemInfoListUI.cs:226-247`).

### Composer inputs that REQUIRE runtime/world state (cannot be computed from the asset alone)

- Durability suffix on `GetFullItemName` (`(Ruined)`) — needs `IItemDurability.Durability` (R).
- Durability-scaled `GetFullItemMoneyValue` — `Item/EquipItem.cs:184-191` multiplies by `merchantDurabilityMinValue/StartPerc` from `RPGBalance.Instance` (asset-resolvable singleton).
- `PotionRecipeItem` description / `(Learned)` suffix — needs `PotionRecipeManager.IsRecipeUnlocked` and `.potionRecipeDescription` (R).
- Skill-requirement color band in the tooltip — needs `PlayerCharacter.instance.Stats.GetStat(...)` (R; `UI/ItemInfoListUI.cs:231-247`).
- `ItemStatInfo.relativeValue` (comparison) — needs `EquipItem.Character.equippedItems` (R).
- `Color`/`negativeColor`/`positiveColor`/sub-effect colors used by `StringTooltip.ApplyColors` (`StringTooltip.cs:59-77`) come from `ArdenfallMasterData.Instance` (asset-resolvable).
- `ItemCategory.CategoryColumn.GetName` decoration (favorite/shortcut markers, illegal/stolen icons) — needs `PlayerCharacter.QuickSlotController` (R) (`ItemCategory.cs:38-55`).

---

## 3. Status effects substrate

### 3.1 `StatusEffectData : SerializedScriptableObject` — `StatusEffectData.cs`

Asset fields:

- `statusEffectName: string` — `:65`.
- `characterNameModifier: string` — `:68`. {0}-template token for the _applier name_ when shown in third-party tooltips.
- `statusEffectIcon: Sprite` — `:70`.
- `tooltip: StatusEffectTooltip` — `:72`. The composed tooltip template object (see 3.3).
- `devNote: string` — `:74`.
- `isHostile: bool` — `:76`.
- `isNegative: bool` — `:78`. Drives potion sign-flip (`Item/ThrowingPotion.cs:236-242`).
- `isDisease: bool` — `:80`.
- `itemMoneyCost: float` — `:82`. Generated potion / scroll price.
- `minLevel: int` — `:84`. Floor for `GetTooltip(level, ...)` (`StatusEffectData.cs:140`).
- `forceAppearIfInfiniteLifetime: bool` — `:86`.
- `onlyApplyToLifeMode: StatusCharacterLifeMode` (Flags) — `:88`.
- `colors: AppliedColor` — `:91` (private, serialized). Color/icon-tint payload (`AppliedColor.cs:7-39`).
- `enableSkinColor: bool` — `:93`.
- `isLegendary: bool` — `:96`.
- `skinColorAsset: StatusEffectSkinColorAsset` — `:99` → ref to `StatusEffectSkinColorAsset.cs:6` (wraps `StatusEffectSkinColor`).
- `skinColor: StatusEffectSkinColor` — `:102` (`StatusEffectSkinColor.cs:6-15`: `skinColorBias`, `skinColorScale`, `skinColorPower`, `skinColorEmission`, `skinColorAdd`, `skinColorMax`, `skinColorFadeSpeed`, all float).
- `skinColorImportance: float` — `:105`.
- `customSkinColorColor: bool` / `skinColorColor: Color` — `:108`, `:111`.
- `particlePrefab: GameObject` — `:113`. FX.
- `attachParticles`, `destroyParticlesOnRemove`, `disableParticleRotation`, `hideInFirstPerson: bool` — `:115-121`.
- `onApplySound: ArdenAudioClip` — `:123`.
- `aiValue: LeveledFloat` — `:125`.
- `aiType: AIStatusEffectType` — `:127` (enum `Friend|Enemy`).
- `effects: List<Effect>` — `:131-132` (Odin-serialized, see §3.2).
- `modifyStatusEffects: List<ModifyEffectInfo>` — `:134`. Each entry references another `StatusEffectData` and adjusts its level/duration (`StatusEffectData.cs:23-31`).
- Test-only: `testLevel`, `testLifetime`, `testTargetSelf` — `:137-141`.
- Generation knobs (potion + recipe generation): `generateDrinkPotion`, `generateThrowingPotion`, `generationPotionCount`, `enableCustomPotionLifetime`, `customDrinkPotionLifetime`, `customThrowingPotionLifetime`, `potionStackMode`, `generateRecipe`, `effectColorTesting` — `:144-160`.
- Exposed: `SkinColor` (`:162`), `SkinColorColor` (`:164-173`), `Color => colors` (`:175`).

`StatusEffectData.GetTooltip(level, lifetime, targetSelf)` (`StatusEffectData.cs:180-183`) is the canonical entry point; it calls `tooltip.GetTooltip(Mathf.Max(minLevel, level), lifetime, targetSelf, this)`.

### 3.2 `Effect` hierarchy — `Effect.cs:5-58`

`Effect` is abstract (`Effect.cs:5`). The fields each subclass declares become the variables `StringTooltip.GetValueFromField` can pluck via reflection by name (see 3.3). Concrete subclasses by file (every match for `: Effect` under the namespace):

- `AddEffectOnWeatherEffect` (`AddEffectOnWeatherEffect.cs:7`) — `statusEffect: LeveledLeveledStatusEffect`.
- `AnimationSpeedEffect` (`AnimationSpeedEffect.cs:3`) — `speedMultiplier: LeveledFloat`.
- `BeamEffect` (`BeamEffect.cs:5`) — `beamPrefab: GameObject` (FX-only).
- `BlindEffect` (`BlindEffect.cs:3`) — `startPointModifier: LeveledFloat`.
- `CalmEffect` (`CalmEffect.cs:7`) — `targetImportance: int`.
- `CancelAttackEffect` (`CancelAttackEffect.cs:6`) — `chance: LeveledFloat`.
- `CarryWeightEffect` (`CarryWeightEffect.cs:3`) — `filter: ItemFilter`, plus added weight on the carry-weight modifier.
- `ChoiceCheckEffect` (`ChoiceCheckEffect.cs:7`) — categorical filter.
- `ComboHitEffect` (`ComboHitEffect.cs:3`) — `scaleDamageBase: LeveledFloat`.
- `DamageEffect` (`DamageEffect.cs:3`) — `damageValue: LeveledFloat`, `damageType: DamageType`.
- `DamageTypeModifyEffect` (`DamageTypeModifyEffect.cs:5`).
- `DamageTypeResistEffect` (`DamageTypeResistEffect.cs:5`) — `damageType: DamageType`, `addResistance: LeveledFloat`, `multiplyResistance: LeveledFloat`.
- `DestroyOnDeathEffect` (`DestroyOnDeathEffect.cs:6`).
- `DialogModEffect` (`DialogModEffect.cs:5`) — `statementModifier: DialogStatementModifier`.
- `DisguiseEffect` (`DisguiseEffect.cs:5`).
- `EnchantmentLevelEffect` (`EnchantmentLevelEffect.cs:5`) — `itemFilter`, `enchantmentFilter`, `modification: LeveledFloat`, `isAddition: bool`.
- `FOVEffect` (`FOVEffect.cs:5`).
- `FearEffect` (`FearEffect.cs:6`).
- `FlowGraphEffect` (`FlowGraphEffect.cs:11`).
- `FrenzyEffect` (`FrenzyEffect.cs:7`) — `newTargetDelay: LeveledFloat`.
- `GeneralCharacterModEffect` (`GeneralCharacterModEffect.cs:7`) — bag of `CharacterModFloat`/`CharacterModInt` mods; the most-referenced effect for stat-style tooltips (e.g. carry weight, damage out).
- `InteractionCancelEffect` (`InteractionCancelEffect.cs:6`).
- `ItemStatModificationEffect` (`ItemStatModificationEffect.cs:5`) — `itemFilter: ItemFilter` + numeric modification.
- `KnockbackEffect` (`KnockbackEffect.cs:3`) — `knockbackStrength: LeveledFloat`.
- `LevitateEffect` (`LevitateEffect.cs:3`).
- `MaterialOverrideEffect` (`MaterialOverrideEffect.cs:5`) — material/visual only.
- `MeleeEffect` (`MeleeEffect.cs:6`).
- `ModMaxStatEffect` (`ModMaxStatEffect.cs:3`) — `type: ModPerSecondEffect.StatType` (`Health|Mana|Stamina|Breath`), `modification: LeveledFloat`, `addition: bool`, `fillStat: bool`. The variable most tooltip templates use for `"+X Max Health"`.
- `ModPerSecondEffect` (`ModPerSecondEffect.cs:6`) — `type`, `baseValue: LeveledFloat`, `damageType: DamageType`, `applyOnceASecond`, `minValue`, `stopOnFill`, `modifyApplierCharacter`, plus tooltip helpers `TotalDeltaTooltip(level, duration)` and `MaxDeltaTooltip(level, duration)` — both invoked by `StringTooltip` via method reflection (`ModPerSecondEffect.cs:81-92`).
- `ModStatEffect` (`ModStatEffect.cs:5`) — `stat: StatType`, `modification: LeveledFloat`, `addition: bool`.
- `ModifyCompanionKillTimerEffect`, `ModifyGlobalRelationshipEffect`, `MovementSpeedEffect`, `PullTowardsEffect`, `RangedStatRegenEffect`, `RelationshipEffect`, `RerouteStatusEffectToCompanionEffect`, `ScaleDamageByStatEffect`, `ScaleDamageEffect`, `ShieldVisualEffect`, `SimpleSpellObjectEffect`, `SpawnPostProcessEffect`, `SpawnPrefabOnSelfEffect`, `SpellModifierEffect`, `SpreadDiseaseEffect`, `StaminaUsageModifierEffect`, `StunEffect`, `TempHandItemEffect`, `TemporaryCompanionEffect`, `TriggerOnDamageEffect`, `VoiceFilterEffect`, `WeaponKnockbackEffect`, `WeaponModificationEffect` — each declares the fields named in the `StatusEffectTooltip.variables[i].variableName` template strings; the tooltip composer reaches them through reflection.

**Which fields each Effect contributes to the tooltip**: dictated by `StatusEffectTooltip.variables[i].variableName` per-StatusEffectData asset — _the C# effect subclass exposes the field, the asset selects which one via index + name_. The tooltip template at `tooltip` field plus the `variables` list is therefore the parametric description. The decompile cannot enumerate which variable names actually get referenced without inspecting each individual `StatusEffectData` asset.

### 3.3 The composition pipeline

`LeveledStatusEffect.GetTooltip(level, lifetime, targetSelf)` does **not** exist on `LeveledStatusEffect` directly; the inline call sites are:

```
leveledStatusEffect.StatusEffect.GetTooltip(level, lifetime, targetSelf)
```

(`Item/ConsumableItem.cs:84`, `Item/ThrowingPotion.cs:165`, `Item/EnchantmentInstance.cs` callers, `Item/StatusEffectEnchantmentEffect.cs:73`).

Full caller chain to render a status-effect line in the UI:

1. UI calls `BaseItem.GetEffectsTooltip()` (`UI/ItemInfoListUI.cs:223`).
2. The override (e.g. `ConsumableItem` `:79-101`, `ThrowingPotion` `:160-180`, `EquipItem` `:437-456`) iterates the relevant `LeveledStatusEffect[]` or `EnchantmentState[]`.
3. For each it calls `StatusEffectData.GetTooltip(level, lifetime, targetSelf)` → `StatusEffectTooltip.GetTooltip` (`StatusEffectTooltip.cs:14-31`).
4. `StatusEffectTooltip.GetTooltip` iterates `variables` (each is a `StringTooltip.TooltipVar` with `componentIndex` pointing at an entry in `StatusEffectData.effects`), then calls `StringTooltip.GetValueFromField` (`StringTooltip.cs:79-186`). That helper reflects the named field/property/method on the `Effect` instance, formats it according to `TooltipVarType`/`isPercentage`/`absoluteValue`/`oneMinus`/`multiplier`/`add`/`isInt`/`rountToTenths`, and (for `LeveledStatusEffect` typed fields) recursively calls the sub-effect's tooltip.
5. Final pass: replaces `{level}`, `{lifetime}`, `{target}`, and the `[lif …]` regex segments (`StatusEffectTooltip.cs:25-30`), then `StringTooltip.ApplyColors` substitutes color codes from `ArdenfallMasterData.Instance.tooltipColors`/`tooltipCodes`/`tooltipDurationColor`/`tooltipTargetColor`/`negativeColor`/`positiveColor` (`StringTooltip.cs:59-77`).
6. The enclosing composer joins lines via `StatusEffectUtil.CombineEffectTooltips` (`StatusEffectUtil.cs:175-191`), which appends periods and spaces, and wraps multi-tooltip blocks via `StatusEffectUtil.CombineMainAndSubTooltips` (`StatusEffectUtil.cs:159-173`).

### 3.4 Outbound refs from `StatusEffectData`

- `Sprite statusEffectIcon` — local icon.
- `GameObject particlePrefab` — FX prefab (not tooltip).
- `StatusEffectSkinColorAsset skinColorAsset` — see §6.
- `ArdenAudioClip onApplySound` — audio.
- `Effect[] effects[i]` may transitively reference `StatType` (`ModStatEffect.stat`, `EnchantmentLevelEffect` filters), `StatusEffectData` again (`AddEffectOnWeatherEffect.statusEffect.StatusEffect`, `RerouteStatusEffectToCompanionEffect.statusEffect.StatusEffect`), `DamageType` (an enum — no asset), `PrimaryHandItemData` (`TempHandItemEffect.item`), `EnchantmentData` (via `EnchantmentLevelEffect.enchantmentFilter`).
- `modifyStatusEffects[i].statusEffect: StatusEffectData` — outbound ref.
- `colors.color: Color`; `AppliedColor.IconColor` (`AppliedColor.cs:19-28`).
- Cross-checked against `ColorAsset.cs:5-8`: `ColorAsset` is a `ScriptableObject` wrapping an `AppliedColor color`. Not currently referenced from item assets directly, but it is the canonical color-asset wrapper.

---

## 4. Spell substrate

### 4.1 `SpellData : SerializedScriptableObject` — `SpellData.cs`

Asset fields:

- `spellName: string` — `:71`.
- `tooltip: SpellTooltip` — `:73`. Template object (see 4.4).
- `icon: Sprite` — `:75`.
- `statType: StatType` — `:77`. Drives `GetTooltipItemType` suffix on `SlateSpellItem`.
- `manaCost: float` — `:80`. **Source of mana cost** — multiplied by spell-item `manaCostMultiplier` then run through `StatCalculations.CalculateManaCost(level, manaCost, manaCostMultiplier)` at `Item/SlateSpellItem.cs:413-419`.
- `AIValue: LeveledInt` — `:83` (private, serialized).
- `isIlligal: bool` — `:85`.
- `quickUseForNPC: bool` — `:87`.
- `aiSpellType: AISpellType` — `:89`.
- `itemBehavior: RangedItemAIBehavior` — `:91`.
- `enableSimpleHandObject: bool` — `:93`.
- `handObject: SimpleSpellHandObject` — `:95`. Visual.
- `enableColor: bool` — `:98`.
- `useStatusEffectColor: StatusEffectData` — `:100`. **Outbound ref** to a `StatusEffectData` asset (used to pull color).
- `simpleColor: AppliedColor` — `:104`.
- `quickUseCooldown: LeveledFloat` — `:106`.
- `castCooldown: LeveledFloat` — `:108`.
- `castHardCooldown: LeveledFloat` — `:110`.
- `aiCooldownMultiplier: float` — `:112`.
- `castSounds: List<ArdenAudioClip>` — `:114`. Audio.
- `spellEffectReference: SpellData` — `:116`. **Outbound ref to another SpellData** (inheritance of effects; `SpellData.Spells` getter at `:141-150` concatenates the referenced spell's effects).
- `spells: List<SpellEffect>` — `:121` (private; Odin).
- `subSpells: List<SubSpellData>` — `:125`. Nested:
  - `SubSpellData.name: string` — `:14`.
  - `SubSpellData.effects: List<SpellEffect>` — `:18`.
- Test/generation: `testLevel`, `generateSpellSlate`, `generateSpellScroll`, `generateSpellStave`, `generationSpellForm: MasterSpellListAsset.SpellForm`, `generationSpellLevelCount` — `:128-138`.
- Exposed: `Color` getter (`:152-160`), `Spells` getter (`:163-173`).

### 4.2 `LeveledSpellData` — `LeveledSpellData.cs:7-26`

- `spellData: SpellData` — `:9` (public field).
- `level: float` — `:11`.
- `enableSecondaryLevel: bool` — `:15` (private, serialized).
- `secondaryLevel: float` — `:18` (private, serialized).
- `GetSecondaryLevel()` returns `secondaryLevel` if enabled, else `level` (`:20-26`).

### 4.3 `LeveledLeveledSpellData` — `LeveledLeveledSpellData.cs:7-19`

- `spellData: SpellData` — `:9`.
- `level: LeveledInt` — `:12`. Note: type differs from `LeveledSpellData` (LeveledInt vs raw float).
- `GetLeveledSpell(int)` collapses to a `LeveledSpellData` at runtime.

### 4.4 `SpellTooltip` — `SpellTooltip.cs:8-70`

- `tooltip: string` (TextArea) — `:23`.
- `variables: List<TooltipSpellVar>` — `:26`. Each entry is a `StringTooltip.TooltipVar` plus `isSubspell: bool`, `isTargetSelf: bool`, `subspellEffectIndex: int`, `usesSecondaryLevel: bool` (`SpellTooltip.cs:10-19`).
- `GetTooltip(level, secondaryLevel, spellData)` looks up either `spellData.Spells[componentIndex]` or `spellData.subSpells[componentIndex].effects[subspellEffectIndex]` and feeds it through `StringTooltip.GetValueFromField` (`SpellTooltip.cs:28-67`).

### 4.5 `SpellEffect` hierarchy — `SpellEffect.cs:7-78`

`SpellEffect` is abstract. Public field on base: `castMode: SpellData.SpellCastMode` (`SpellEffect.cs:9`). Concrete subclasses (each can contribute fields visible in `SpellTooltip.variables` plus sub-tooltips via `GetSubTooltips`):

- `AOESpellEffect` (`AOESpellEffect.cs:10`) — `aoeEffect: LeveledLeveledStatusEffect`, plus range/projectile fields.
- `FlingSpellEffect` (`FlingSpellEffect.cs:7`) — `knockbackAmount: LeveledFloat`.
- `IncreaseCompanionTimeSpellEffect` (`IncreaseCompanionTimeSpellEffect.cs:10`) — `targetDistance: LeveledFloat`.
- `LocationSpellEffect` (abstract — `LocationSpellEffect.cs:8`).
- `ProjectilePrefabSpellEffect` (`ProjectilePrefabSpellEffect.cs:8`) — projectile prefab refs.
- `ProjectileSpellEffect` (`ProjectileSpellEffect.cs:12`) — extensive projectile data.
- `RaiseDeadAOESpellEffect` (`RaiseDeadAOESpellEffect.cs:9`) — `radius: LeveledFloat`.
- `RaiseDeadSpellEffect` (`RaiseDeadSpellEffect.cs:11`).
- `RangedAttackSpellEffect` (`RangedAttackSpellEffect.cs:7`) — `verticalHeight: LeveledFloat`.
- `RunGraphSpellEffect` (`RunGraphSpellEffect.cs:9`) — `flowGraph: FlowGraph`.
- `SelfStatusEffectSpellEffect` (`SelfStatusEffectSpellEffect.cs:8`) — `statusEffect: LeveledLeveledStatusEffect`. Outbound ref to `StatusEffectData`.
- `ShieldVisualSpellEffect` (`ShieldVisualSpellEffect.cs:7`).
- `SoundsSpellEffect` (`SoundsSpellEffect.cs:8`) — `castSounds: List<ArdenAudioClip>`.
- `SpawnCharacterSpellEffect` (`SpawnCharacterSpellEffect.cs:9`) — `charactersToSpawn: List<CharacterData>`.
- `StatusEffectTooltipSpellEffect` (`StatusEffectTooltipSpellEffect.cs:8`) — `statusEffects: List<LeveledLeveledStatusEffect>` and `targetSelf: bool`. `GetSubTooltips` iterates each entry and emits its `StatusEffectData.GetTooltip(level, lifetime, targetSelf)` (`StatusEffectTooltipSpellEffect.cs:16-22`).
- `SubTooltipSpellEffect` (`SubTooltipSpellEffect.cs:5`) — `tooltip: SpellTooltip`; `GetSubTooltips` returns `tooltip.GetTooltip(level, secondaryLevel, spellData)` (`:7-11`).
- `SubspellFilterSpellEffect` (`SubspellFilterSpellEffect.cs:7`) — `subspell: string`.
- `SummonCharacterSubSpellEffect` (`SummonCharacterSubSpellEffect.cs:9`) — `charactersToSpawn: List<CharacterData>`.
- `TargetAIValueSpellEffect` (`TargetAIValueSpellEffect.cs:8`) — `StatusEffectAIValue` list.
- `TargetStatusEffectSpellEffect` (`TargetStatusEffectSpellEffect.cs:9`) — `targetDistance: LeveledFloat`, status-effect application list.
- `TrapSpellEffect` (`TrapSpellEffect.cs:8`) — trap prefab.
- `UpdatingSpellEffect` (abstract — `UpdatingSpellEffect.cs:9`).

### 4.6 Spell tooltip composer chain (caller chain)

1. `SlateSpellItem.GetEffectsTooltip` (`Item/SlateSpellItem.cs:211-234`) calls `itemData.spellData.Get().spellData.GetTooltip(SpellInputMode.Primary, level, secondaryLevel)`, then `secondarySpellData.spellData.GetTooltip(SpellInputMode.Secondary, ...)`.
2. `SpellData.GetTooltip` (`SpellData.cs:181-244`):
   a. `tooltip.GetTooltip(level, secondaryLevel, this).Trim()` — main line.
   b. Iterates `spells` (i.e. `SpellEffect`s) and appends each `spell.GetTooltip(level)` (base default `null`).
   c. Iterates `spells` again and concatenates `spell.GetSubTooltips(this, level, secondaryLevel)` results.
   d. Wraps the sub-tooltip block in the `spellSubEffectColor` color tag (from `ArdenfallMasterData.Instance.spellSubEffectColor`).
   e. Prepends `ArdenfallMasterData.Instance.primarySpellTooltip` or `.secondarySpellTooltip` (template prefix strings).
3. UI calls `GetItemStatInfos` → 'Mana Usage' row via `GetManaCost()`.
4. `GetTooltipItemType` reads `spellData.spellData.statType.statName` + suffix.

### 4.7 What `SlateSpellItem` actually pulls from `SpellData`

- `spellName` (name; `Item/SlateSpellItem.cs:188`).
- `statType` → `statType.statName` (item-type label; `:285`) and `statType.id` (for level + skill calc; `:319-323`).
- `manaCost` (mana row; `:418`).
- `tooltip` (effects line; via `SpellData.GetTooltip`).
- `Spells` (sub-effect tooltips and ranged-attack capabilities).
- `castCooldown` / `castHardCooldown` / `quickUseCooldown` (`Item/SlateSpellItem.cs:53-91`; rendered as cooldown overlays in the HUD, not in the static tooltip itself).
- `icon` (`Item/SlateSpellItem.cs:193`).
- `Color`/`useStatusEffectColor`/`simpleColor` via `SpellData.Color` (`Item/SlateSpellItem.cs:198-201`).
- `aiCooldownMultiplier`, `itemBehavior`, `aiSpellType` (AI only — not tooltip).

---

## 5. Enchantment substrate

### 5.1 `EnchantmentData : SerializedScriptableObject` — `Item/EnchantmentData.cs`

Asset fields:

- `enchantmentName: string` — `:12`.
- `enchantmentIcon: Sprite` — `:15`.
- `enchantmentIconColor: Color` — `:17`.
- `tooltip: EnchantmentTooltip` — `:19`. Template (see 5.3).
- `hideEffectTooltips: bool` — `:21`. Suppresses sub-tooltip rendering.
- `moneyValue: float` — `:23`.
- `showEnchantmentColor: bool` — `:25`.
- `enableEnchantmentMesh: bool` — `:27`.
- `enableCustomEnchantmentColor: bool` — `:29`.
- `customEnchantmentColor: Color` — `:31`.
- `customEnchantmentColorImportance: int` — `:33`.
- `baseItemDataFilterBlacklist: List<ItemData>` — `:35`. Outbound ref array to other `ItemData`.
- `baseItemDataFilterWhitelist: List<ItemData>` — `:37`. Outbound ref array.
- `effects: List<EnchantmentEffect>` — `:42` (Odin-serialized). See 5.4.
- `testLevel: float` — `:45`.

`EnchantmentData.GetTooltip(level, item)` (`Item/EnchantmentData.cs:54-79`): builds main `tooltip.GetTooltip(level, this, item)` then concatenates each effect's `GetSubTooltip` via `StatusEffectUtil.CombineEffectTooltips`, wrapped in `spellSubEffectColor`.

### 5.2 `LeveledEnchantmentData` — `Item/LeveledEnchantmentData.cs:6-19`

- `enchantment: EnchantmentData` — `:7`.
- `level: float` — `:8`.
- `hidden: bool` — `:10`.

### 5.3 `EnchantmentTooltip` — `EnchantmentTooltip.cs:9-67`

- `tooltip: string` (TextArea) — `:25`.
- `variables: List<TooltipEnchVar>` — `:28`. Each entry has `componentIndex`, `isTargetSelf: bool`, and a `targetVars: List<TooltipItemTargetEnchVar>` where each entry overrides the template per-item-type (`EnchantmentTooltip.cs:11-22`).

`GetTooltip` (`EnchantmentTooltip.cs:30-62`):

- If `targetVars` contains the item being rendered, the template is **replaced wholesale** with `targetVar.text`.
- Otherwise the variable is filled via `StringTooltip.GetValueFromField`.
- Final `{level}` substitution + `StringTooltip.ApplyColors`.

### 5.4 `EnchantmentEffect` subclasses (all under `Item/`)

- `ClothingParticlesEnchantmentEffect` (`Item/ClothingParticlesEnchantmentEffect.cs:9`) — `particlePrefab: GameObject`, `applyOnItemPickup: bool`. **No sub-tooltip override** → contributes nothing to tooltip text.
- `GreatswordAttackEnchantmentEffect` (`GreatswordAttackEnchantmentEffect.cs:8`) — `aoeRange: LeveledFloat`, `onHitVisualEffect: VisualEffect`, `damageMultiplier: LeveledFloat`, `eventName: string`, `castPosition: Vector3`, `castDistance: float`, `castMask: LayerMask`. **No sub-tooltip override**.
- `KatanaAttackEnchantmentEffect` (`KatanaAttackEnchantmentEffect.cs:9`) — `movementSpeed`, `movementTime`, `damageMultiplier: LeveledFloat`, `onHitVisualEffect: VisualEffect`, `forceSlowdown`, `requireStamina: bool`, `kickSetting: CameraSettings.FOVKickSettings`, `enemyDetectionLayer: LayerMask`, `enemyDetectionDistance`, `enemyDetectionRadius: float`. **No sub-tooltip override**.
- `KnockbackEnchantmentEffect` (`Item/KnockbackEnchantmentEffect.cs:8`) — `knockbackStrength: LeveledFloat`, `successChance: LeveledFloat`. **No sub-tooltip override**.
- `ModifyArmorEnchantmentEffect` (`Item/ModifyArmorEnchantmentEffect.cs:3`) — **empty class** (decompile shows only `public class ModifyArmorEnchantmentEffect {}`). Note: declared **outside** the `EnchantmentEffect` hierarchy in the decompile; this is stub-only and contributes nothing.
- `StatusEffectEnchantmentEffect` (`Item/StatusEffectEnchantmentEffect.cs:8`) — `triggerEvent: StatusEffectEnchantmentEffectEvent` (`OnEquip|OnDamage|OnAim|OnUnSheath`), `target: StatusEffectEnchantmentEffectTarget` (`Self|Target`), `successChance: LeveledFloat`, `successChanceProjectile: LeveledFloat`, `meleeOnlyHardAttack: bool`, `statusEffect: LeveledLeveledStatusEffect` (outbound ref to `StatusEffectData`), `hideEnchantmentTooltip: bool`, `visibility: StatusEffectVisibility`, `onDamageSaveState: bool`. **Sub-tooltip**: `statusEffect.StatusEffect.GetTooltip(level, lifetime, !flag)` (`Item/StatusEffectEnchantmentEffect.cs:65-73`).
- `SubTooltipEnchantmentEffect` (`Item/SubTooltipEnchantmentEffect.cs:6`) — `tooltip: EnchantmentTooltip`. Sub-tooltip returns `tooltip.GetTooltip(level, enchantment, item)` (`:8-11`).
- `TimedEnchantmentEffect` (`Item/TimedEnchantmentEffect.cs:5`) — `enchantmentToApply: EnchantmentData` (outbound ref), `enchantmentLevel: LeveledFloat`, `timeRange: TimeRangeAsset`. **No tooltip override** but transitively cascades into another enchantment.
- `TriggerOnDamageEnchantmentEffect` (`Item/TriggerOnDamageEnchantmentEffect.cs:7`) — `filterIncomingDamageForm: DamageFormFlags`, `blackListIncomingDamageWeapon: List<ItemData>`, `whiteListIncomingDamageWeapon: List<ItemData>`, `applyToAttacker: bool`, `successChance: LeveledFloat`, `applyStatusEffects: List<LeveledLeveledStatusEffect>` (outbound refs), `selectRandomStatusEffect: bool`, `statusEffectCreationInfo: StatusEffectCreationInfo`, `damage: LeveledFloat`, `damageForm: DamageForm`, `damagePoint: bool`, `scaleDamageByIncomingDamage: bool`, `maxDamage: LeveledFloat`. **Sub-tooltip**: iterates `applyStatusEffects` and joins their tooltips (`:34-46`).
- `TriggerOnThrowingHitEnchantment` (`Item/TriggerOnThrowingHitEnchantment.cs:6`) — `triggerOnlyHitCharacters`, `triggerOnlyHitSurface: bool`, `effectOnTrigger: VisualEffect`. **No sub-tooltip override**.
- `WeaponDamageModifyEnchantmentEffect` (`Item/WeaponDamageModifyEnchantmentEffect.cs:5`) — `enableFactionFilter: bool`, `whitelistedFactions`, `blacklistedFactions: List<Faction>`, `addMeleeDamage: LeveledFloat`, `multiplyMeleeDamage: LeveledFloat`. **No sub-tooltip override**.
- `WeaponModificationEnchantmentEffect` (`Item/WeaponModificationEnchantmentEffect.cs:3`) — three `GeneralCharacterModEffect.CharacterModFloat` mods: `modifyBleedChance`, `modifyCritChance`, `modifyStunChance`. **No sub-tooltip override**.
- `EnchantmentLevelEffect` — this is an `Effect` (status-effect subclass), NOT an `EnchantmentEffect`; it lives at `EnchantmentLevelEffect.cs:5` and references `ItemFilter`, `EnchantmentDataFilter`, `modification: LeveledFloat`, `isAddition: bool`.

### 5.5 Enchantments: baked into the asset or applied at runtime?

Both. The static asset declares two arrays (`EquipItemData.enchantments` at `Item/EquipItemData.cs:20` and `EquipItemData.builtInEnchantments` at `:23`). On `EquipItem.CreateState` (called when the instance is materialized — `Item/EquipItem.cs:91-99`), `InitializeStaticEnchantments` (`Item/EquipItem.cs:161-181`) pushes a `noSave` `EnchantmentState` per asset-declared enchantment.

`EquipItem.GetEnchantments()` (`Item/EquipItem.cs:411-414`) returns the live `enchantmentStates` list. For a _static_ compendium item with no player context, that list is exactly the union of the asset's `enchantments` and `builtInEnchantments` arrays — none of the dynamic add paths (`AddEnchantment`, save-state restore, `EnchantmentLevelEffect.RefreshEnchantments`) fire. So enchantment data is **statically extractable** as `EnchantmentData` refs + their `level` + `hidden` flags, matching the in-tooltip output of `EquipItem.GetEffectsTooltip`.

---

## 6. Shared substrate

### 6.1 `StatType : ScriptableObject` — `StatType.cs:6-38`

- `id: string` — `:9`.
- `isAttribute: bool` — `:11`.
- `statName: string` — `:14`.
- `icon: Sprite` — `:16`.
- `iconColor: Color` — `:18`.
- `statDescription: string` — `:20`.
- `longStatDescription: string` — `:23` (TextArea).
- `affects: List<string>` — `:25`.
- `skillAffects: List<string>` — `:27`.
  Method `GetStat(character)` requires runtime context (`:29-37`).

### 6.2 `ItemCategory : ScriptableObject` — `ItemCategory.cs:14-221`

- `categoryName: string` — `:203`.
- `icon: Sprite` — `:205`.
- `defaultItemIcon: Sprite` — `:207` (used as fallback for `BaseItem.GetIcon` at `Item/BaseItem.cs:182`).
- `categoryColor: Color` — `:209` (used by `BaseItem.GetIconColor` at `Item/BaseItem.cs:188`).
- `showInAllCategory: bool` — `:211`.
- `columns: List<CategoryColumn>` — `:213`. Each `CategoryColumn` (`ItemCategory.cs:18-198`) carries `label: string`, `icon: Sprite`, `preferedWidth/flexibleWidth: float`, flags (`itemName`, `isItemIconAndCategory`, `itemValue`, `isAffectedBySkillRequirement`, `isAffectedByBrokenDurability`, `affectingRedColor`, `affectingIconsAfter`, `hideIfNegativeOne`), `alignment: TextAlignmentOptions`, and `itemDataField`/`itemFunctionField: string` (used reflectively at `:152-179`).

### 6.3 `ItemTag : ScriptableObject` — `Item/ItemTag.cs:6-10`

- `tagName: string` — `:8`.
- `description: string` (TextArea) — `:9`. Read by `BaseItem.GetEffectsTooltip` (`Item/BaseItem.cs:139-153`).

### 6.4 `TooltipAssetData` — `Item/TooltipAssetData.cs:9-79`

Not a `ScriptableObject` — it's a serializable struct/class held by other configs. Fields:

- `icons: List<TooltipIconSet>` — `:36`. Maps `TooltipIcon { weight, value, defense, damage }` (`:13-18`) → `Sprite`.
- `simpleTooltipPrefab`, `iconPrefab`, `iconListPrefab`, `barTooltipPrefab: GameObject` — `:38-44`.
- `fontSizeNormal`, `fontSizeLarge`, `fontSizeHeader: float` — `:46-50`.
- `negativeColor: Color` — `:52`.
- `positiveColor: Color` — `:54`.

### 6.5 `ArdenfallMasterData : ScriptableObject` — `ArdenfallMasterData.cs:18-334`

Tooltip-relevant fields (everything else is balance/UI plumbing):

- `positiveColor`, `negativeColor`, `quickslotInventoryColor`, `spellSubEffectColor: Color` — `:84-90`.
- `merchantTypeMismatchIcon`, `unmetSkillIcon`, `brokenDurabilityIcon`, `ruinedDurabilityIcon`, `illegalItemMerchantIcon`, `stolenItemMerchantIcon: string` (sprite-format templates) — `:94-104`.
- `unmetSkillMessage`, `brokenDurabilityMessage`, `ruinedDurabilityMessage: string` — `:106-110`.
- `termSetColors: List<TermSetColor>`, `globalTermSets: List<TermSetContainer>`, `termColorMatch: string` — `:116-120`.
- `tooltipColors: List<TooltipColor>` (`code/color/text` triples — `:22-28`) — `:124`.
- `tooltipTargetColor`, `tooltipDurationColor: Color` — `:126`, `:128`.
- `tooltipCodes: List<TooltipCodes>` (`code → text` pairs — `:31-35`) — `:131`.
- `primarySpellTooltip`, `secondarySpellTooltip: string` — `:133`, `:135`.
- `enchantmentItemColor: Color` — `:144`.
- `allAttributes: List<StatType>`, `allSkills: List<StatType>`, `allTraits: List<TraitType>` — `:171-175`.
- `statBookMessage: string` — `:185`.

### 6.6 `MasterSpellListAsset : ScriptableObject` — `MasterSpellListAsset.cs:8-95`

Not directly referenced from item tooltip rendering, but it owns the catalog of generated spell items (base slate/scroll/stave templates, additional spell lists). Fields include `spellSlateBaseTarget/Shoot/Cast: SlateSpellItemData`, equivalent scroll/stave bases, paths, format strings, leveled lists (`List<ItemListAsset>`), and `additionalLists: List<AdditionalSpellList>` (each carrying `spells: List<SpellData>`).

### 6.7 `StatusEffectSkinColor` / `StatusEffectSkinColorAsset` — `StatusEffectSkinColor.cs:6-15`, `StatusEffectSkinColorAsset.cs:6-9`

- `StatusEffectSkinColor`: seven floats — `skinColorBias/Scale/Power/Emission/Add/Max/FadeSpeed`.
- `StatusEffectSkinColorAsset`: `ScriptableObject` wrapping one `StatusEffectSkinColor`.
- Referenced from `StatusEffectData.skinColorAsset` (`StatusEffectData.cs:99`) and `StatusEffectData.skinColor` (`StatusEffectData.cs:102`).

### 6.8 `StatusEffectTrigger` — `StatusEffectTrigger.cs:7-31`

`MonoBehaviour` carrying `effects: List<LeveledStatusEffect>` and `creationInfo: StatusEffectCreationInfo` (`:9-11`). Runtime collider; not relevant to item assets.

### 6.9 `LeveledLeveledStatusEffect` — `LeveledLeveledStatusEffect.cs:7-27`

- `statusEffect: StatusEffectData` — `:9`.
- `level: LeveledFloat` — `:12`.
- `lifetime: LeveledFloat` — `:15`.
- `stackMode: StatusEffectData.StackMode` — `:18`.
  Resolves to a `LeveledStatusEffect` at a given level via `GetLeveledStatusEffect(level)` (`:24-27`).

### 6.10 `RecipeItem` — `Item/RecipeItem.cs:6-26`

- `tag: ItemTag` — `:8` (outbound ref).
- `count: int` — `:10`.

### 6.11 `NoteItem.NoteContents` — `Item/NoteItem.cs:11-25`

- `NoteContents.sections: List<NoteSection>` — `:13`.
- `NoteSection.textContent: string` (TextArea) — `:19`.
- `NoteSection.imageContent: Sprite` — `:21`.
- `NoteSection.separator: bool` — `:23`.

### 6.12 `PotionRecipe : ScriptableObject` — `Item/PotionRecipe.cs:7-107`

- `drinkablePotions: List<ThrowingPotionData>` — `:13` (outbound refs).
- `throwingPotions: List<ThrowingPotionData>` — `:15`.
- `lockedByDefault: bool` — `:17`.
- `enableSkillRequirement: bool` — `:19`.
- `skillRequirement: int` — `:21`.
- `levelModifier: float` — `:23`.
- `successModifier: float` — `:25`.
- `recipe: List<RecipeItem>` — `:27`.
- Computed `RecipeName` reads `drinkablePotions[0].GetEffectName()` else `throwingPotions[0].GetEffectName()` (`:29-37`).
- `IsValid`, `HasDrinkingPotions`, `HasThrowingPotions` — `:39-53`.

### 6.13 `AppliedColor` / `ColorAsset`

- `AppliedColor` — `AppliedColor.cs:6-39`. Fields: `color: Color`, `applyToIcons: bool`, `applyToParticles: bool`, `applyToMeshRenderers: bool`; `IconColor` getter zero-suppresses if `applyToIcons` is false.
- `ColorAsset : ScriptableObject` — `ColorAsset.cs:5-8`. Single field: `color: AppliedColor`.

---

## 7. Currently extracted vs not extracted

### 7.1 `ItemData` (base)

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractItem.cs:17-114`):

- `id` (`:18`).
- `name` via `GetItemName()` with safe fallback (`:20-23`, `:115-149`).
- `weight`, `value`, `description`, `stackable`, `hideInGui`, `questItem`, `notLootableChance`, `cannotBeOwned`, `isIllegal` — all `Parameter<T>.Get()` with provenance (`:25-89`).
- `iconRef`, `quickslotIconRef`, `categoryRef` — resolved via `RefResolver` (`:62-95`).
- `tags` (list of GUIDs only; tag _id_ not tag _content_) — `:97-110`.

**Not extracted, NEEDED for tooltip parity:**

- `pickupSounds`, `inventoryVisualMesh`, `inventoryVisualContainer`, `pickupMeshList` — visual/audio; not tooltip-needed (intentional skip).

**Not extracted, NOT needed for item tooltip but needed for downstream pages:**

- None at base level.

### 7.2 `EquipItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractEquipment.cs:11-17`):

- `equipSlot` (string-joined `usableSlots`), `minimumSkill`, `statType` (as `ToString()` of the `StatType` ScriptableObject — not a ref, raw name).

**Not extracted, NEEDED for tooltip parity:**

- `enchantments: LeveledEnchantmentData[]` — required for `EquipItem.GetEffectsTooltip` to emit any enchantment text (`Item/EquipItem.cs:437-456`). **Critical gap.**
- `builtInEnchantments: SmartListParameter<LeveledEnchantmentData>` — same. **Critical gap.**
- `statType` is captured but as `Object.ToString()` (= asset name), not as a `SnapshotRef`. The tooltip's skill-requirement line uses `StatType.statName` (`UI/ItemInfoListUI.cs:235`); the extractor never resolves this StatType into a SnapshotRef and never carries `statName` / `id`. **Gap.**
- `useMultipleSlots` — affects slot rendering (currently inferred indirectly via comma-joined slots, but the bool is dropped). Low priority.
- `enchantmentCostMultiplier` — needed only for enchant UI cost; not tooltip.

**Not extracted, needed for downstream pages:**

- `onEquipSound`, `additionalBodyObject`, `additionalBodyHook` — equip UX only.

### 7.3 `HandItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractHandItem.cs:9-13`):

- `animationSpeedMultiplier`.

All other `HandItemData` fields are visual/audio. No tooltip parity gap.

### 7.4 `PrimaryHandItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractPrimaryHand.cs:9-13`):

- `twoHanded`.

**Not extracted, NEEDED for tooltip parity:** none (the too extract).

### 7.5 `MeleeItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractMelee.cs:10-16`):

- `damage`, `criticalHitChance`, `meleeDurabilityMax` (alias of `durabilityMax`), `canBlock`.

**Not extracted, NEEDED for tooltip parity:**

- `hardAttackDamMult` — drives the in-game tooltip's "Heavy Attack Damage" row computed as `damage * hardAttackDamMult` in `MeleeItem.GetItemStatInfos` (`Item/MeleeItem.cs:521-527`). **Critical gap** — every melee weapon page is missing this row today.
- `attributeType: StatType` — separate from `EquipItemData.statType`; used by `MeleeItem.ItemAttributeId` (`Item/MeleeItem.cs:54-58`). Not on tooltip; needed for downstream "which weapons scale with which attribute" reverse queries.
- `bleedStatusEffect: LeveledStatusEffect` (`Item/MeleeItemData.cs:31`) — referenced by combat logic and by the bleed status-effect detail page reverse lookup ("weapons that cause bleed").

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `stunChance`, `bleedChance`, `pierceChance`, `stealthStunChance`, `critDamageMult`, `knockbackStrength`, `knockbackStrengthHard`, `stealthHitMultiplier`, `bleedMultiplier`, `hitStopTime`, `hardAttackStaminaMultiplier`, `quickAttackStaminaMultiplier`, `blockStaminaMultiplier`, `parryStaminaMultiplier`, `canParry`, `canBeParried`, `aiAlwaysTryToBlock` (`Item/MeleeItemData.cs:15-73`). Combat math + stat-comparison value on detail pages; not in the in-game tooltip body but shown on the dedicated melee stat table.

### 7.6 `ArmorItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractArmor.cs:9-15`):

- `armorRating`, `armorDurabilityMax` (alias of `durabilityMax`), `coverageSlot` (string-joined `usableSlots`).

**Not extracted, NEEDED for tooltip parity:**

- The `armorRating` value is rendered as **"Damage Threshold"** in the game's tooltip (`Item/ArmorItem.cs:115-122` calls `ItemStatInfo.GetComparisonTooltip(..., "Damage Threshold")`), not as "Armor". This is a label-derivation gap, not a field gap — we have the value, we use the wrong label site-side. **Critical gap.**
- `EquipItemData.statType` is required (not `MeleeItemData.attributeType`) for the tooltip item-type label (`Item/ArmorItem.cs:71-74` reads `itemData.statType.Get()?.statName`). Same statType gap as in §7.2.

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `onlyEquipIfMatchesAvatar`, `clothingAsset` (avatar / mesh), `armAnimationOffset`, `feetOffGroundModifier`, `feetRotationModifier`, `materialSound`, `materialSoundWet`, `armorShuffleSounds`, `attachVoiceFilters`, `onDurabilityBreakSounds` (`Item/ArmorItemData.cs:15-30`). Visual/audio only.

### 7.7 `BowItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractBow.cs:14-34`):

- `itemTypeTooltip`, `damage`, `bleedMultiplier`, `shootStaminaMultiplier`, `criticalHitChance`, `stunChance`, `bleedChance`, `critDamageMult`, `knockbackStrength`, `stealthHitMultiplier`, `ammoMassMultiplier`, `damageFalloffDistance`, `damageFalloff`, `durabilityMax`, `projectileSlot`, `projectileIconRef`, `aimAnimationSpeedMultiplier`, `bleedStatusEffectJson`.

**Not extracted, NEEDED for tooltip parity:** none — bow extraction is already thorough relative to `BowItem.GetTooltipItemType` (`Item/BowItem.cs:202-205`, reads `itemTypeTooltip`) and `BowItem.GetItemStatInfos` (`Item/BowItem.cs:430-435`, reads `damage`).

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `onAttackSound`, `additionalOnAttackSound`, `aimSound`, `onDurabilityBreakSounds` (audio); `itemAIBehavior: RangedItemAIBehavior` (`Item/BowItemData.cs:54`); `shootCameraKick`, `aimCameraKick`, `aimCameraKickWait` (`Item/BowItemData.cs:56-60`). Visual/audio/AI only.

### 7.8 `ArrowItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractArrow.cs:14-23`):

- `damage`, `spawnVisualOnHitStatic`, `spawnVisualOnHitCharacter`, `respawnItemPickupChance`, `addItemToInventoryChance`, `projectileSettingsJson`, `projectileRef`.

**Not extracted, NEEDED for tooltip parity:** none — `ArrowItem.GetTooltipItemType` returns the constant string `"Arrow"` (`Item/ArrowItem.cs:52-55`) and `ArrowItem.GetItemStatInfos` reads `damage` (`Item/ArrowItem.cs:145-150`).

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `hitMaterialSound` (`Item/ArrowItemData.cs:25`). Audio only.

### 7.9 `ThrowingItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractThrowingItem.cs:15-37`):

- `itemTypeTooltip`, `damage`, `pierceArmor`, `bleedMultiplier`, `damageFalloffDistance`, `damageFalloff`, `critChance`, `stunChance`, `bleedChance`, `critDamageMult`, `quickslotCooldownTime`, `stealthHitMultiplier`, `spawnVisualOnHitStatic`, `spawnVisualOnHitCharacter`, `respawnItemPickupChance`, `addItemToInventoryChance`, `missileSettingsJson`, `missileRef`, `bleedStatusEffectJson`.

**Not extracted, NEEDED for tooltip parity:** none — `ThrowingItem.GetTooltipItemType` reads `itemTypeTooltip` (`Item/ThrowingItem.cs:195-198`); `ThrowingItem.GetItemStatInfos` reads `damage` (`Item/ThrowingItem.cs:187-192`).

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `missileRotation: Vector3`, `onShootSounds`, `onHitSounds`, `itemAIBehavior: RangedItemAIBehavior`, `quickThrowAction: QuickThrowAction` (`Item/ThrowingItemData.cs:13,49-55`). Visual/audio/AI/HUD only.

### 7.10 `ThrowingPotionData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractThrowingPotion.cs:15-25`):

- `quickslotSecondaryColorJson`, `areaOfEffectRange`, `areaOfEffectJson` (snapshots `LeveledStatusEffect[]` with refs), `visualLevel`, `effectName` (precomputed via `GetEffectNameSafe` mirroring `ThrowingPotionData.GetEffectName`), `isDrinkingPotion`.

**Not extracted, NEEDED for tooltip parity:**

- The `areaOfEffectJson` snapshots include refs + `level` + `lifetime` + `stackMode` but **not the StatusEffectData behind each ref**. Without the new `status-effect` entity, the composer cannot expand `areaOfEffect[i].StatusEffect.GetTooltip(level, lifetime, targetSelf = isDrinkingPotion)` (`Item/ThrowingPotion.cs:160-180`), so every potion's "On Drink:" / "On Hit:" effect body remains a placeholder. **Critical gap; resolves once `status-effect` is extracted.**

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `onDrinkSounds`, `onEffectSounds`, `areaOfEffectParticles`, `singleEffectParticles` (`Item/ThrowingPotionData.cs:11-17`). Audio/FX only.

### 7.11 `SlateSpellItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractSlateSpell.cs:14-24`):

- `quickslotSecondaryColorJson`, `spellDataJson` (a `LeveledSpellDataSnapshot` carrying `spellRef`, `spellName`, `level`, `secondaryLevel`, and a `subSpells: SubSpellSnapshot[]` shape where each entry is only `{name, effectTypeNames: string[]}` — i.e. **class names of the sub-spell effects, no payload fields**), `secondarySpellDataJson` (same shape), `spawnWhenSheathed`, `spellItemType` (`Slate`/`Scroll`/`Stave`), `durabilityMax`, `manaCostMultiplier`.

**Not extracted, NEEDED for tooltip parity:**

- The full `SpellData` — `spellName` (we have it), but also `manaCost` (`SpellData.cs:80`), `tooltip: SpellTooltip` (`SpellData.cs:73`) including `tooltipTemplate` and `tooltipVariables`, `statType` (`SpellData.cs:77` — drives both the item-type label suffix at `Item/SlateSpellItem.cs:283-286` and the skill-requirement statType id at `Item/SlateSpellItem.cs:301-313`), `spells: SpellEffect[]` (`SpellData.cs:121`), `subSpells: SubSpellData[]` (`SpellData.cs:125`) with full effect payloads, `spellEffectReference: SpellData` (`SpellData.cs:116`, inheritance), `useStatusEffectColor: StatusEffectData` (`SpellData.cs:100`), `simpleColor: AppliedColor` (`SpellData.cs:104`). Today the snapshot has only the ref + spell name + level numbers + sub-spell _type names_. **Critical gap; resolves once `spell` is extracted.**
- `ItemPresentationBuilder.cs:151-162` already reads keys (`spellDataJson.name` / `spellDataJson.id`) that the adapter never emits — the adapter emits `spellName` / `spellRef`. **Bug in the current builder, not just a missing field.**

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `castCameraKick`, `castSecondaryCameraKick`, `castHardCameraKick`, `aimCameraKick`, `aimCameraKickWait`, `quickCastAction`, `onDurabilityBreakSounds` (`Item/SlateSpellItemData.cs:24-36`). FX/audio/HUD only.

### 7.12 `ConsumableItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractConsumable.cs:17-25`):

- `quickslotCooldownTime`, `statusEffectsJson` (a `LeveledStatusEffectSnapshot[]` with refs + level + lifetime + stackMode).

**Not extracted, NEEDED for tooltip parity:**

- The full `StatusEffectData` behind each `statusEffects[i].StatusEffect` ref. `ConsumableItem.GetEffectsTooltip` (`Item/ConsumableItem.cs:79-101`) composes the user-visible `"On Consume: Restores 150 Health for Self for 3 Seconds."` lines by calling `statusEffects[i].StatusEffect.GetTooltip(level, lifetime, targetSelf = true)`. Without the new `status-effect` entity, the composer cannot expand this text. **Critical gap; resolves once `status-effect` is extracted.**

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `onConsumeSounds` (`Item/ConsumableItemData.cs:14`). Audio only.

### 7.13 `NoteItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractNote.cs:17-42`):

- `noteText` (raw text from `noteTextContents`), `noteSectionsJson` (`NoteSectionSnapshot[]` with `textContent`, `imageRef`, `separator`), `fontAssetRef`, `gainStatRef`, `gainStatCount`.

**Not extracted, NEEDED for tooltip parity:** none — `NoteItem` does not override `GetEffectsTooltip` / `GetTooltipItemType` / `GetItemStatInfos` (`Item/NoteItem.cs:5`). Tooltip parity is already satisfied by the base item fields.

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- `notePrefab: GameObject` (`Item/NoteItemData.cs:14`). Visual only. The actual reading UX is its own concern — out of scope for tooltip parity.

### 7.14 `PotionRecipeItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractPotionRecipe.cs:17-33`):

- `potionRecipeJson` (`PotionRecipeSnapshot` carrying `recipeName`, `isValid`, `hasDrinkingPotions`, `hasThrowingPotions`, `lockedByDefault`, `enableSkillRequirement`, `skillRequirement`, `levelModifier`, `successModifier`, `ingredients: RecipeIngredientSnapshot[]` (each with `tagRef` + `count`), `drinkablePotionRefs`, `throwingPotionRefs`).

**Not extracted, NEEDED for tooltip parity:**

- `PotionRecipeItem.GetTooltipDescription` (`Item/PotionRecipeItem.cs:21-29`) reads `WorldSingleton<PotionRecipeManager>.Instance.potionRecipeDescription`, a runtime-resolved format string outside `ArdenfallMasterData`. This is the only tooltip text on recipe items beyond the base description. **Resolves once the `master-tooltip-vocabulary` private singleton includes `potionRecipeDescription` from `PotionRecipeManager.cs:20-30`.**
- `PotionRecipeItem.GetFullItemName` appends `(Learned)` based on `PotionRecipeManager.IsRecipeUnlocked(recipe)` (`Item/PotionRecipeItem.cs:11-18`). Player-state — drop for the static compendium.

**Not extracted, not needed for item tooltip but needed for downstream pages:**

- The `ingredients` tag content (current snapshot only carries tag refs); resolves once the `item-tag` entity carries `tagName`/`description` so the recipe page can render "2 × Mountain Berries" instead of "2 × <tagRef>".

### 7.15 `RepairKitItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractRepairKit.cs`):

- `repairAddAmount`, `repairPercentageAmount`, `repairSkillAddAmount`, `repairSkillMultAmount`.

**Not extracted, NEEDED for tooltip parity:** none — `RepairKitItem` does not override any tooltip composer (`Item/RepairKitItem.cs:5-27`). Tooltip parity is already satisfied by base item fields plus the "Repair Items" input button which is a runtime interaction, not tooltip text.

**Not extracted, not needed for item tooltip but needed for downstream pages:** none.

### 7.16 `LockpickItemData`

**Extracted** (`mod/src/Entities/Item/Adapters/ExtractLockpick.cs`):

- `successChance`.

**Not extracted, NEEDED for tooltip parity:** none — `LockpickItem` has no composer overrides (`Item/LockpickItem.cs:5`).

**Not extracted, not needed for item tooltip but needed for downstream pages:** none.

### 7.17 `CurrencyItemData`

**Extracted:** nothing (no `Extract*.cs` adapter; `ItemVariantClassifier.cs:46,71` maps currency to an empty `Layers` array).

**Not extracted, NEEDED for tooltip parity:** none — `CurrencyItem` has no overrides (`Item/CurrencyItem.cs:3`). Currency items render only the base item fields.

**Not extracted, not needed for item tooltip but needed for downstream pages:** none.

### 7.18 Per-entity sibling gaps (entities not currently extracted at all)

These are sibling assets referenced from items that today exist only as opaque `SnapshotRef` GUIDs. None has a canonical pipeline entity, snapshot DTO, read-model, or detail page. They are the bulk of the work for this slice.

- **`stat-type`** — `StatType.cs:6-38`. Captured as a ref via `EquipItemData.statType`, `MeleeItemData.attributeType`, `NoteItemData.gainStat`, `ModStatEffect.stat`, `SpellData.statType`. Required for tooltip skill-requirement label and item-type labels on armor / melee / slate-spell.
- **`item-category`** — `ItemCategory.cs:14-221`. Captured as a ref via `ItemData.category`. Source of `categoryColor` (the icon tint that the site currently drops) and `defaultItemIcon` (fallback for items without their own icon).
- **`item-tag`** — `Item/ItemTag.cs:6-10`. Captured as a list of refs via `ItemData.tags`. Source of `tagName` and `description` (the "Incredibly valuable remedy" line in `BaseItem.GetEffectsTooltip`, `Item/BaseItem.cs:139-153`).
- **`status-effect`** — `StatusEffectData.cs:65-161`. Captured as refs via `MeleeItemData.bleedStatusEffect`, `BowItemData.bleedStatusEffect`, `ThrowingItemData.bleedStatusEffect`, `ThrowingPotionData.areaOfEffect`, `ConsumableItemData.statusEffects`, `StatusEffectEnchantmentEffect.statusEffect`, `TriggerOnDamageEnchantmentEffect.applyStatusEffects`, plus internally between status effects via `modifyStatusEffects` and `AddEffectOnWeatherEffect`. Required for every "On Consume:" / "On Drink:" / "On Hit:" tooltip body and every weapon/armor enchantment line.
- **`spell`** — `SpellData.cs:71-138`. Captured as refs via `SlateSpellItemData.spellData` / `secondarySpellData`. Required for every slate-spell item's name composition (via `SpellData.spellName`), item-type label (via `SpellData.statType`), mana cost row, and effects body.
- **`enchantment`** — `Item/EnchantmentData.cs:5-79`. Captured as refs via `EquipItemData.enchantments` and `EquipItemData.builtInEnchantments` — and these refs themselves are dropped at the adapter (see §7.2). Required for every weapon/armor enchantment line that the game's `EquipItem.GetEffectsTooltip` (`Item/EquipItem.cs:437-456`) emits.
- **`potion-recipe`** — `Item/PotionRecipe.cs:7-107`. Captured as a JSON snapshot embedded in `PotionRecipeItemData` extraction, but not promoted to a canonical entity with a detail page. Required for "/recipes" pages plus reverse lookups "items that teach this recipe" and "potions produced by this recipe".

All seven also need: full effect-instance extraction (the `Effect` / `SpellEffect` / `EnchantmentEffect` subclass payloads), per-asset `tooltipTemplate` + `tooltipVariables`, per-asset icon + color, per-asset graph edges to anything they reference, and a corresponding public detail page.

---

## 8. Tooltip-parity gap summary

Ordered list of every data atom the in-game item details panel (`UI/ItemInfoListUI.SetBasicStuff` `:213-247` + `UI/ItemInfoListUI.UpdateStatValues` `:370-396`) requires but the current extraction does not produce, grouped by which asset type owns the atom.

### 8.1 Atoms owned by `ItemData` (base item)

1. **Tag content for the tooltip tag block.** `BaseItem.GetEffectsTooltip` iterates `itemData.tags.Get()` and emits `"{tagName}: {description}"` per tag (`Item/BaseItem.cs:139-153`). Today only tag GUIDs are extracted; tag names and descriptions live on the unextracted `item-tag` entity. Owner asset: `ItemTag` (`Item/ItemTag.cs:6-10`).
2. **Category-derived icon fallback and tint.** `BaseItem.GetIcon` falls back to `category.defaultItemIcon` when `itemData.icon == null` (`Item/BaseItem.cs:179-183`), and `BaseItem.GetIconColor` returns `category.categoryColor` (`Item/BaseItem.cs:187-194`). The mod's `ItemIconSlots.BaseDisplayColor` already reads `category.categoryColor` for the extracted `displayIconColor` (`mod/src/Entities/Item/ItemIconSlots.cs:12,43-47`), but `defaultItemIcon` is never resolved as an asset, and the site doesn't apply the captured color anyway. Owner asset: `ItemCategory` (`ItemCategory.cs:203-209`).

### 8.2 Atoms owned by `EquipItemData`

3. **Skill requirement line "{statName} Skill: {minimum}".** `UI/ItemInfoListUI.cs:226-247` reads `EquipItem.GetMinimumStat()` (`Item/EquipItem.cs:325-332`) which returns `(statType.id, minimumSkill)`. We capture `minimumSkill` and `statType.ToString()` but not the resolvable StatType entity carrying `statName`. Owner asset: `StatType` (`StatType.cs:14`).
4. **Static enchantment lines.** `EquipItem.GetEffectsTooltip` iterates `enchantmentStates` built from `EquipItemData.enchantments[]` and `builtInEnchantments[]` (`Item/EquipItem.cs:161-181,437-456`); neither array is in the snapshot today (`mod/src/Entities/Item/Adapters/ExtractEquipment.cs:12-17`). Owner assets: `LeveledEnchantmentData` (`Item/LeveledEnchantmentData.cs:6-19`) → `EnchantmentData` (`Item/EnchantmentData.cs:5-79`).

### 8.3 Atoms owned by `MeleeItemData`

5. **Heavy Attack Damage row.** `MeleeItem.GetItemStatInfos` emits `damage * hardAttackDamMult` labelled "Heavy Attack Damage" (`Item/MeleeItem.cs:521-527`). We capture `damage` but not `hardAttackDamMult` (`mod/src/Entities/Item/Adapters/ExtractMelee.cs:10-16`). Owner field: `MeleeItemData.hardAttackDamMult` (`Item/MeleeItemData.cs:35`).

### 8.4 Atoms owned by `ArmorItemData`

6. **Label "Damage Threshold" for the armor-rating row.** Value present (`armorRating` extracted), label not. The label lives in the game composer's hard-coded string at `Item/ArmorItem.cs:115-122`. Site-side fix only — no new extraction needed once the pre-computed `stat_rows_json` carries the label.

### 8.5 Atoms owned by `SlateSpellItemData` and `SpellData`

7. **Mana Usage row.** `SlateSpellItem.GetItemStatInfos` computes the value via `GetManaCost()` which reads `spellData.spellData.manaCost * itemData.manaCostMultiplier` and applies the level math (`Item/SlateSpellItem.cs:236-241,413-419`). We have `manaCostMultiplier` on the item; we do not have `manaCost` on the spell (`LeveledSpellDataSnapshot` only carries `spellRef`, `spellName`, `level`, `secondaryLevel`, and sub-spell class names — see `mod/src/Entities/Item/Adapters/ItemAdapterHelpers.cs:238-247`). Owner field: `SpellData.manaCost` (`SpellData.cs:80`).
8. **Item-type label "{statName} Slate" / "Scroll" / "Stave".** `SlateSpellItem.GetTooltipItemType` reads `spellData.spellData.statType.statName + suffix` (`Item/SlateSpellItem.cs:283-286`). Spell's `statType` ref is not in the snapshot. Owner field: `SpellData.statType` (`SpellData.cs:77`).
9. **Effects body for primary + secondary slate spells.** `SlateSpellItem.GetEffectsTooltip` calls `spellData.spellData.GetTooltip(SpellInputMode.Primary, level, secondaryLevel)` and `secondarySpellData.spellData.GetTooltip(SpellInputMode.Secondary, ...)` (`Item/SlateSpellItem.cs:211-234`). `SpellData.GetTooltip` composes from `tooltip: SpellTooltip`, `spells: SpellEffect[]`, `subSpells: SubSpellData[]`, plus `spellEffectReference: SpellData` inheritance (`SpellData.cs:181-244`). None of these are extracted today; only sub-spell _class names_ are kept. Owner asset: `SpellData` (`SpellData.cs:71-138`) plus every `SpellEffect` subclass that the spell's `tooltipVariables` references.

### 8.6 Atoms owned by `StatusEffectData`

10. **Effect body lines on consumables, throwing potions, weapon-bleed status, and weapon-enchantment on-hit effects.** Composed by `StatusEffectData.GetTooltip(level, lifetime, targetSelf)` → `StatusEffectTooltip.GetTooltip` → per-effect `StringTooltip.GetValueFromField` (`StatusEffectData.cs:180-183`, `StatusEffectTooltip.cs:14-31`, `StringTooltip.cs:90-204`). Requires the StatusEffectData asset's `tooltipTemplate`, `tooltipVariables`, `effects: Effect[]` payloads, `minLevel`, plus color expansion via `ApplyColors` / `ApplyColorCodes`. None extracted.

### 8.7 Atoms owned by `EnchantmentData`

11. **Enchantment lines on equipped items.** Composed by `EnchantmentData.GetTooltip(level, item)` → `EnchantmentTooltip.GetTooltip` (`Item/EnchantmentData.cs:54-79`, `EnchantmentTooltip.cs:30-62`), with per-item-type wholesale template replacement via `targetVars` and suppression via `hideEffectTooltips` / `StatusEffectEnchantmentEffect.hideEnchantmentTooltip`. Requires the EnchantmentData asset's template, variables, effects (including the recursive `StatusEffectEnchantmentEffect.statusEffect` → `StatusEffectData` link), and the item-target match table. None extracted.

### 8.8 Atoms owned by `PotionRecipeItemData` runtime context

12. **`PotionRecipeManager.potionRecipeDescription` template.** Format string `"Learn the potion recipe {0}"` lives on the runtime `PotionRecipeManager` singleton, not on `ArdenfallMasterData` (`PotionRecipeManager.cs:20-30`). Needed for the recipe-item description override. Resolved by adding it to the `master-tooltip-vocabulary` singleton (it is the only field in the singleton that does not originate on `ArdenfallMasterData`).

### 8.9 Atoms owned by `ArdenfallMasterData`

13. **Color expansion vocabulary.** `StringTooltip.ApplyColors` reads `tooltipColors`, `tooltipCodes`, `tooltipTargetColor`, `tooltipDurationColor`, `positiveColor`, `negativeColor` (`StringTooltip.cs:54-74`, fields at `ArdenfallMasterData.cs:84-131`). The fixture's `master-tooltip.json` today carries only `tooltipCodes` and `tooltipColors`.
14. **Term-set link pass.** `ArdenfallMasterData.ApplyColorCodes` walks `termSetColors`, `globalTermSets`, `termColorMatch` (`ArdenfallMasterData.cs:116-124,229-268`) to substitute `<link>` markers — a separate pass from `ApplyColors` that the current rich-text translator does not perform.
15. **Spell tooltip prefixes and sub-effect wrap.** `primarySpellTooltip`, `secondarySpellTooltip` (`ArdenfallMasterData.cs:133-135`) prepend a header on slate-spell effect bodies; `spellSubEffectColor` (`ArdenfallMasterData.cs:90`) wraps sub-tooltips inside the spell composer (`SpellData.cs:223-237`). Not yet captured.
16. **Skill / durability warning strings (informational only — colour bands are player-state).** `unmetSkillMessage`, `brokenDurabilityMessage`, `ruinedDurabilityMessage` (`ArdenfallMasterData.cs:106-110`). The colour bands are player-state-dependent and stay omitted; the strings themselves are useful as compendium "how this works" notes on stat / item pages.

### 8.10 Atoms folded out of the public contract

17. **"Canonical compendium state / Base item, no player or inventory context."** Has no in-game counterpart; lives only in the current `ItemPresentationBuilder` heuristic. Removed from the public contract by this slice.
18. **Equipped-comparison delta (`+25` style).** `ItemStatInfo.GetComparisonTooltip` reads `Character.equippedItems.GetItem(slot)` (`Item/ItemStatInfo.cs:42-52`) — player state. Stays omitted; `omissions_json` records the omission as a diagnostic.
19. **Durability current / colour band.** `UI/ItemInfoListUI.cs:255-279` reads runtime `IItemDurability.Durability`. Stays omitted; only `MaxDurability` ships.
20. **Stolen / quest-item / merchant-cost icons.** Player-state and merchant-state dependent. Stays omitted.
