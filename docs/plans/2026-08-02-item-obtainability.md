---
title: Item Obtainability
type: audit
status: active
created: 2026-08-02
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Item Obtainability, 2026-08-02

Every way a player can obtain an item in Ardenfall, established from the decompiled source and confirmed with live probes against Ardenfall Demo `0.0.10.91`, with a structural check against the non-public playtest build recorded below. Item provenance spans authored assets, authored graph grants, and streamed scene objects, so the audit measures each owner before treating it as a source.

The 2026-08-03 release has 2,266 public pages, with 1,379 lacking an inbound edge. Items account for 726 of those unlinked pages, so this audit still decides the next provenance slice.

## The sources

| source | mechanism | identity | enumerable | verdict |
| --- | --- | --- | --- | --- |
| Loot tables | `ItemListAsset`, weighted nested groups | authored asset | **348 loaded assets**, reaching 811 distinct items | The 530 reached from `CharacterData.itemLists` are exactly the 530 already published as `can_drop` edges. The other 278 items sit behind 182 lists with no at-rest asset references and require the 683-cell world walk. |
| NPC inventory | `CharacterData.itemLists` rolled at spawn | authored template, **314** placed records | complete | complete |
| Enemy death | corpse carries the NPC's own inventory | as above | complete | complete |
| Merchants | `CharacterData.merchantItemLists` plus additions | authored template, per-NPC stock | **0 entries at rest** | No merchant inventory is configured in the measured release. |
| Quest rewards | `ItemsQuestReward` | authored, typed list | **38** quests, 4 item rewards | probed, extractable without the graph |
| Graph grants | `AddItemListNode`, `SpawnItemNode` | authored, Odin graph | live only | complete, needs a live probe |
| Potion crafting | standalone `PotionRecipe` asset with tag-based ingredients | authored asset | **48 recipes**, reaches 127 unlinked items | Missing entity, extractable without the world walk |
| Recipe learning | `PotionRecipeItemData` variant | authored item, **2** items | **2** item rows in a dead table | The variant remains. Its payload is replaced by a reference to the standalone recipe entity. |
| Containers and spawners | per-placed-instance lists and items | **scene only, not record-backed** | partial | the coverage hole |

Live counts: 1,273 `ItemData`, 193 `ThrowingPotionData`, 64 `EnchantmentData`, 3 `SimpleItemListAsset`, 0 `MerchantCategory`.

## Findings that change the design

**Character inventories are already covered.** `CharacterBase.cs:574-580` generates a character's inventory once at spawn from `CharacterData.itemLists`, and `DeadBodyContainer.cs:321-333` transfers that same live `Inventory` to the corpse. A live probe measured 530 items through this owner, exactly matching the 530 items already published by `can_drop` edges. There is no new item reachability in this path. The one exception is `DeadBodyContainer.CreateBodyFromData`, used for pre-placed corpses, which generates with `randomizeLootable`.

**Merchant and catalog owners are empty at rest.** A live probe measured zero entries in `CharacterData.merchantItemLists`, `CharacterItemGroup`, and `CharacterModule.itemLists`. It measured zero loaded instances of `MasterPotionListAsset` and `MasterSpellListAsset`. These declarations are not reachable authored owners in the release and must not be ranked as populated item sources.

**Recipes are standalone assets.** `PotionRecipe` has 48 loaded assets. `RecipeItem.cs:5-25` matches each ingredient by `ItemTag` and count, so ingredients are tags rather than named items. The two `PotionRecipeItemData` items remain recipe-scroll variants, but their two rows in `item_potion_recipes` are a dead table because no TypeScript in `pipeline/src` or `site/src` reads it. The standalone recipe entity replaces that variant payload and reaches 127 currently unlinked items without a world walk.

**The 348 figure is an asset count, not an opportunity count.** All 348 `ItemListAsset` candidates are loaded at rest and reach 811 distinct items. The 530 reachable through `CharacterData.itemLists` are exactly the 530 already published by `can_drop`. The remaining 278 unlinked items sit behind 182 lists with no at-rest asset references. Those lists are scene-owned and require the 683-cell streamed traversal. Authored item provenance and world scene enumeration are one slice, not two separately rankable slices.

**Enchantment data is a second cheap authored entity.** The game has 64 `EnchantmentData` assets, which reach 19 currently unlinked items. Together with the 48 standalone recipes, this adds 158 currently unreachable item pages a first inbound link and 112 pages of their own without a world walk.

**Containers are the only real coverage hole.** `Container` does not implement `IInstanceRecordSceneObject`, unlike `Door`, which is why portals were extractable as record-backed instances and chests are not. Containers exist only as scene objects in a world that streams by cell. A probe in the starting area sees 57 containers, 185 item spawners and 178 free pickups, and the world is 25x23 overworld cells plus 12x9 interior. Enumerating them all means traversing 683 cells, which is a world walk rather than a lookup.

## Scope, and what the playtest build changes

Everything above is measured against **Ardenfall Demo `0.0.10.91`**, which is the only build we extract from. A second build is installed locally, the non-public playtest, and its `Assembly-CSharp.dll` was compared **structurally only**: a type-name listing, no data export, no launch, nothing decompiled beyond one class. 2,931 types against the demo's 2,802, with 232 present only in the playtest.

**The ruling-out holds.** No cooking, smithing, salvage, disassembly or upgrade system exists in the playtest either. That claim was originally made from the demo alone, which was premature, and it is now checked.

Four differences matter for item provenance.

**A crime system exists** (`Ardenfall.Crime.*`, with regions, witnesses, bounty and prison locations). It does not add a source. An owned chest's contents are still that chest's contents, so theft is a condition attached to an existing source rather than a route of its own. Item ownership and steal detection already exist in the demo, only the consequences are new.

**Quests can put items into a specific container.** `AddItemsToContainerNode` pairs with `OfflineObjectManager`, which queues an inventory change against a container **GUID** and applies it when that container next loads. This is a genuine additional source, and it is also evidence that containers carry an authored, addressable identity that authored content already relies on, which is relevant to the identity problem noted above.

**Items are moddable.** `Ardenfall.Importing.*` and `ModAssetManager` mean the full game's item set is not closed. A compendium generated from one snapshot describes the base game, and should probably say so.

**Difficulty is a system** (`DifficultyManager`), so loot and level scaling may vary by setting. Worth checking before publishing any probability as fact.

Smaller: `LeveledPotionRecipeItem`, and two new enchantment effects.

**The methodological point is the one to keep.** The demo is a subset, and a conclusion drawn from it is only true of it. Any claim here that rules something out is demo-scoped unless it says otherwise, and this section is the only part checked against both.

## What is not a source

**Enchanting** mutates an existing `EquipItem` through `AddEnchantment` (`EquipItem.cs:344-373`) rather than producing an item. It is provenance worth showing on an item page, not a way to obtain one. There is no player-facing enchanting UI.

**Repair** consumes a kit or gold and changes durability in place (`RepairUILayer.cs:134-165`). No item is created.

**`ItemConverter`** declares `convertToItem` and `itemCount` and has no callsite. Dead.

No cooking, smithing, disassembly, salvage or upgrade system exists. Ruling those out matters as much as finding the rest.

## Randomisation, which a reader needs stated

A loot list is a weighted nested graph. `ItemGroup` either evaluates every entry or performs weighted pick-X, entries can nest another `ItemListAsset` or a group with no depth limit, and weights can vary by level range. A per-item probability is computable as the product of conditional pick probabilities along a path, summed over paths, but nested repeats make it fiddly rather than a lookup.

Persistence differs by source and changes what is true for a reader. An untouched container is not saved and rerolls on reload (`Container.cs:205-215`). An interactable cache saves a taken flag and never repeats (`InteractableItemSpawner.cs:179-188`). Merchants persist stock and restock on a day threshold (`MerchantController.cs:65-84`). Quest rewards fire once, guarded by a terminal-state check (`QuestInstance.cs:314-318`).

Reputation and faction affect merchant *prices* through `TradeDiscount` and a relationship multiplier, not what a merchant stocks.

## Proposed shape

Provenance is one relationship with several sources rather than several unrelated features. An item page should answer "where does this come from" with a single list whose rows name a source and how reliable it is.

The authored sources with data at rest include loot, NPCs, enemies, quests, graph grants, and standalone recipes and enchantments. The merchant and master-list owners measured empty or absent at rest and add no populated source. ItemList provenance beyond the already published character path and the placed half of provenance require a cell traversal.

The placed half is containers, spawners, and the 278 items behind 182 unreferenced item lists. It needs a cell traversal to be complete, and it shares that requirement with tile capture, which also has to visit every cell. Those two should be planned together rather than each paying for world traversal separately.
