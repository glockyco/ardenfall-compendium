---
title: "Item Icon and Tooltip Decompiled Audit"
type: audit
status: implemented
created: 2026-05-14
parent:
superseded_by:
archived: 2026-06-25
---

# Item Icon and Tooltip Decompiled Audit

**Game version:** Ardenfall Demo `0.0.10.91`  
**Decompiled source cache:** `.decompiled/0.0.10.91-63c576261184/`  
**Purpose:** Ground Slice 3 asset/icon planning and confirm whether rich tooltips belong there or in the later item presentation slice.

## Icon behavior

Primary item icons are behavior-derived, not a raw `ItemData.icon` field read.

Relevant sources:

- `types/Ardenfall_Item_ItemData.cs` declares `Parameter<Sprite> icon`, `Parameter<Sprite> quickslotIcon`, and `Parameter<ItemCategory> category`.
- `csharp/Ardenfall/Item/BaseItem.cs` implements `GetIcon()` as `itemData.icon.Get()` with fallback to `itemData.category.Get()?.defaultItemIcon`.
- `csharp/Ardenfall/Item/BaseItem.cs` implements `GetIconColor()` as `itemData.category.Get()?.categoryColor ?? Color.white`.
- `csharp/Ardenfall/ItemCategory.cs` declares category-level `icon`, `defaultItemIcon`, `categoryColor`, and inventory column metadata.
- `csharp/Ardenfall/Item/SlateSpellItem.cs` overrides `GetIcon()` to prefer `spellData.Get().spellData.icon`, then `itemData.icon.Get()`, then category default; it overrides `GetIconColor()` to prefer spell color.
- `csharp/Ardenfall/Item/ThrowingPotion.cs` overrides `GetIcon()` to prefer `areaOfEffect[0].StatusEffect.statusEffectIcon`, then base icon fallback; it overrides `GetIconColor()` to prefer status-effect color.
- `csharp/Ardenfall/Item/BowItem.cs` implements `IItemCountItem.GetIcon()` as the loaded arrow icon, falling back to `projectileIcon.Get()`.
- `csharp/Ardenfall/Item/ThrowingItem.cs` implements `IItemCountItem.GetIcon()` as `itemData.icon.Get()`.
- `csharp/Ardenfall/UI/InventorySlotUI.cs` uses `ISecondaryIconItem.SecondaryIcon` instead of `GetIcon()` for secondary-icon items; `HUDQuickSlotItemUI.cs`, `EquippedItemSlotUI.cs`, `QuickLootSlotUI.cs`, `QuickSlotItemUI.cs`, `IngredientSlotUI.cs`, and `RepairItemUI.cs` call `GetIcon()` plus `GetIconColor()`.

Slice 3 implications:

1. Export a behavior-derived `displayIcon` slot, not only raw `iconRef`. For normal items this is `BaseItem.GetIcon()`; for slate spells and throwing potions it must honor their overrides.
2. Export `displayIconColor` as `{ r, g, b, a }` so site placeholders/tints can match game semantics.
3. Keep raw source refs separately where useful: `iconRef`, `quickslotIconRef`, `projectileIconRef`, `categoryRef`, and future category assets. Do not collapse them into the display icon.
4. Include secondary icon slots for `ISecondaryIconItem` (`secondaryIcon`, `secondaryIconColor`) because inventory UI uses those for slate spells and throwing potions.
5. Include count/ammunition icon slots later only if item count UI is in scope; bow/throwing count icons are not required for basic overview/detail item icons.
6. Do not depend on `BuiltLookupTable` GUIDs for Sprite identity. Slice 2 live data showed almost all notable Sprite refs were unresolved through lookup refs. Slice 3 should export actual sprite pixels and identify them by content hash.
7. Sprite export must handle sprite atlases/rects. `Sprite.texture` may be a larger texture than the logical icon; the exporter should crop using sprite rect/texture rect before hashing/encoding.

## Tooltip behavior

Tooltips are runtime behavior strings assembled by item instances, status effects, spells, enchantments, and UI code. They are not a single data field.

Relevant sources:

- `csharp/Ardenfall/UI/ItemInfoListUI.cs` renders title, description, effects, type, requirements, and stat rows by calling `BaseItem`/subclass methods: `GetFullItemName()`, `GetTooltipDescription()`, `GetEffectsTooltip()`, `GetTooltipItemType()`, `GetItemStatInfos()`.
- `csharp/Ardenfall/Item/BaseItem.cs` builds base effect tooltips from item tags via `StatusEffectUtil.CombineMainAndSubTooltips(...)`.
- `csharp/Ardenfall/Item/ConsumableItem.cs` adds an `<b>On Consume:</b>` section by calling `StatusEffectData.GetTooltip(...)` for each status effect.
- `csharp/Ardenfall/Item/ThrowingPotion.cs` adds either `<b>On Drink:</b>` or `<b>On Hit:</b>` based on `isDrinkingPotion` and calls `StatusEffectData.GetTooltip(...)`.
- `csharp/Ardenfall/Item/EquipItem.cs` merges enchantment tooltips into base tag effects.
- `csharp/Ardenfall/Item/PotionRecipeItem.cs` appends recipe text using `PotionRecipe.RecipeName` and a manager-owned format string.
- `csharp/Ardenfall/Item/SlateSpellItem.cs` uses `SpellData.GetTooltip(...)` for primary and secondary spell data.
- `types/Ardenfall_StatusEffectData.cs`, `csharp/Ardenfall/StatusEffectTooltip.cs`, and `csharp/Ardenfall/StringTooltip.cs` resolve tooltip variables reflectively, apply game color codes, lifetime/target placeholders, and nested status-effect strings.
- `types/Ardenfall_SpellData.cs` builds spell tooltips from base spell tooltip, spell effect tooltips, sub-tooltips, and master-data prefixes.

Slice 3 implications:

1. Rich item tooltips are not part of Slice 3. Keep them in Slice 4 item presentation depth.
2. Slice 3 should only unblock tooltip visuals by making icons available; it should not try to serialize fully rendered game tooltip markup.
3. Slice 4 should decide whether tooltip output is generated in the mod (behavior-exact but runtime-state-sensitive) or reconstructed in the pipeline/site from structured fields (more portable but more work). That decision needs its own plan.
4. Slice 4 must treat Unity/TMP rich text as input, not safe HTML. Formatting requires a sanitizer/translator from game markup (`<color>`, `<b>`, sprite tokens, custom tooltip codes) to safe site rendering.
5. Stat comparison tooltip fields are partially player-state-dependent (`ItemStatInfo.GetComparingItem`, minimum stat checks, durability modifiers). Public compendium pages should not copy game comparison behavior unless a stable, non-player-specific comparison contract is designed.

## Live Slice 2 diagnostic baseline for Slice 3

From `snapshots/snapshots/0.0.10.91-20260514-1621097145580/diagnostics.json`:

| Diagnostic key                             | Count | Slice 3 disposition                                                                                                                             |
| ------------------------------------------ | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lookupAssetGuidMissing:iconRef`           |  1271 | Primary Slice 3 target, but solve via pixel export/content hash rather than lookup GUIDs.                                                       |
| `nullAsset:iconRef`                        |     2 | Preserve as intentional missing/fallback icon cases.                                                                                            |
| `lookupAssetGuidMissing:quickslotIconRef`  |   127 | Include if the source sprite exists; useful for quickslot/UI parity but not mandatory for first visible item overview.                          |
| `lookupAssetGuidMissing:projectileIconRef` |    15 | Include if Sprite export is generic; useful for bow ammunition/count UI later.                                                                  |
| `lookupAssetGuidMissing:categoryRef`       |  1268 | Not an image-export problem by itself. Category data/assets may become a separate category/entity task unless needed for display icon fallback. |
| `lookupAssetGuidMissing:spellRef`          |   286 | Defer to Slice 11 spell extraction except where a slate spell display icon directly requires spell icon pixels.                                 |
| `lookupAssetGuidMissing:fontRef`           |    65 | Defer to note/book rich presentation.                                                                                                           |
| `lookupAssetGuidMissing:projectileRef`     |     6 | Defer mesh/prefab asset handling.                                                                                                               |
| `lookupAssetGuidMissing:gainStatRef`       |     1 | Defer to stat/entity reference work.                                                                                                            |
