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

Every way a player can obtain an item in Ardenfall, established from the decompiled source and confirmed with live probes against Ardenfall Demo `0.0.10.91`, with a structural check against the non-public playtest build recorded below. This exists because the roadmap was about to model `ItemListAsset` alone and call item provenance solved. Loot tables are one source among nine.

Items are 1,273 of the 1,455 public pages with no inbound edge, and nothing currently points at an item, so this is the audit that decides the next slice.

## The sources

| source | mechanism | identity | enumerable | verdict |
| --- | --- | --- | --- | --- |
| Loot tables | `ItemListAsset`, weighted nested groups | authored asset | **348** | complete |
| NPC inventory | `CharacterData.itemLists` rolled at spawn | authored template, **314** placed records | complete | complete |
| Enemy death | corpse carries the NPC's own inventory | as above | complete | complete |
| Merchants | `CharacterData.merchantItemLists` plus additions | authored template, per-NPC stock | complete | complete for what a merchant *can* stock |
| Quest rewards | `ItemsQuestReward` | authored, Odin graph | **13** quests | complete, needs a live probe |
| Graph grants | `AddItemListNode`, `SpawnItemNode` | authored, Odin graph | live only | complete, needs a live probe |
| Potion crafting | recipe with tag-based ingredients | authored asset | **48** recipes | complete |
| Recipe learning | `PotionRecipeItem` unlocks a recipe | authored item | **2** | complete |
| Containers and spawners | per-placed-instance lists and items | **scene only, not record-backed** | partial | the coverage hole |

Live counts: 1,273 `ItemData`, 193 `ThrowingPotionData`, 64 `EnchantmentData`, 3 `SimpleItemListAsset`, 0 `MerchantCategory`.

## Four findings that change the design

**Enemy drops are not a loot roll.** `CharacterBase.cs:574-580` generates a character's inventory once at spawn from `CharacterData.itemLists`, and `DeadBodyContainer.cs:321-333` transfers that same live `Inventory` to the corpse. There is no death-time drop table and no separate roll. So "dropped by" is derivable from the same authored lists that furnish the living NPC, which makes enemy provenance far cheaper than expected. The one exception is `DeadBodyContainer.CreateBodyFromData`, used for pre-placed corpses, which generates with `randomizeLootable`.

**Quest graphs are traversable at runtime.** A previous audit concluded that `QuestData.flowGraph` and `objects` are `[NonSerialized] [OdinSerialize]` and therefore invisible. They are invisible to *reflection over serialized fields*, but Odin has deserialized them into real objects by the time the mod runs. `QuestInstance.cs:508-511` reads `questData.flowGraph.graph` directly and `QuestManager.cs:86-90` prewarms the graph assets. A live probe can walk them. Quest item sources are extractable.

**Recipe ingredients are tags, not items.** `RecipeItem.cs:5-25` matches on `item.tags.Get().Contains(tag)`, so a recipe requires a tag and a count rather than a named item. An ingredient page can therefore list every recipe it can contribute to, derived from the tags it carries. This also gives item tags a purpose beyond browsing, and they currently have almost no inbound edges.

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

The authored half is fully enumerable today and covers loot, NPCs, enemies, merchants, quests and crafting. That is the slice worth building, and it does not need the world walked.

The placed half is containers and spawners. It needs a cell traversal to be complete, and it shares that requirement with tile capture, which also has to visit every cell. Those two should be planned together rather than each paying for world traversal separately.
