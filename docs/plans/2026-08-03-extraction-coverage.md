---
title: Extraction Coverage
type: audit
status: active
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Extraction Coverage, 2026-08-03

This audit owns extraction coverage. It does not own loot design, tile design, or roadmap order. See [`2026-08-02-item-obtainability`](2026-08-02-item-obtainability.md), [`2026-08-02-tile-capture`](2026-08-02-tile-capture.md), and the roadmap.

The audit uses these source labels:

- **[snapshot]** The release snapshot and database measured on 2026-08-03.
- **[survey]** [`2026-08-02-program-survey`](2026-08-02-program-survey.md).
- **[obtainability]** [`2026-08-02-item-obtainability`](2026-08-02-item-obtainability.md).
- **[tile]** [`2026-08-02-tile-capture`](2026-08-02-tile-capture.md).
- **[records]** The master-record source audit from 2026-08-03.
- **[assets]** The authored-asset source audit from 2026-08-03.
- **[scene]** The Odin-graph and streamed-scene source audit from 2026-08-03.
- **[fields]** The field-gap source audit from 2026-08-03.

## What the game holds and the compendium covers

The compendium models twelve families in the [snapshot]. The identity mechanism names the source used for the public row id.

| Family | Rows | Identity mechanism | What the row represents |
| --- | ---: | --- | --- |
| `item` | 1,273 [snapshot] | `lookupAsset` | An authored `ItemData` asset. |
| `item-variant` | 16 [snapshot] | `variantId` | A descriptor-defined concrete item type. |
| `item-category` | 7 [snapshot] | `namedAsset` | An `ItemCategory` asset found by its stable name. |
| `item-tag` | 28 [snapshot] | `lookupAsset` | An authored `ItemTag` asset. |
| `stat-type` | 21 [snapshot] | `namedAsset` | A `StatType` asset found by its stable name. |
| `spell` | 56 [snapshot] | `namedAsset` | A `SpellData` asset found by its stable name. |
| `status-effect` | 172 [snapshot] | `lookupAsset` | An authored `StatusEffectData` asset. |
| `faction` | 48 [snapshot] | `lookupAsset` | An authored `Faction` asset. |
| `location` | 48 [snapshot] | `lookupAsset` | An authored `LocationAsset`. |
| `character` | 212 [snapshot] | `namedAsset` | An authored `CharacterData` asset found by its stable name. |
| `npc` | 314 [snapshot] | `record` | A placed `NPCRecord` with a `RecordID`. |
| `portal` | 33 [snapshot] | `record` | A placed `PortalRecord` with a `RecordID`. |

The roadmap table predates the `CharacterExtractor` identity change. It labels `CharacterData` as `lookupAsset`. The extractor uses `namedAsset`, which is authoritative [fields].

The current snapshot also materializes 2,228 detail pages. A rendered-detail measurement finds 307 pages with no inbound link from another detail page [survey]. The unlinked pages include 121 placed-character pages, 103 status-effect pages, 25 faction pages, 20 location pages, 15 character pages, 10 item-tag pages, 8 stat-type pages, 4 portal pages, and 1 spell page [survey].

The graph contains 5,912 edges across 11 predicates [survey]. The icon export covers 21 faction icons, 53 spell icons, and 154 status-effect icons. Every authored icon reference resolves [snapshot].

## What the game holds and the compendium does not cover

The missing content falls into three groups. The groups have different extraction costs.

### Record types in the master record table

This is the lowest-cost group because two record sources already work. `MasterRecordTable` owns an arbitrary dictionary of table wrappers. `GetRecords(Type)` visits each named table, and `RecordTable.GetRecords(Type)` includes subclasses through `IsAssignableFrom` [records]. The instances wrapper scans every map cell, so all present `InstanceRecord` subclasses are reachable [records].

| Record type | Current status | Known count or limit | Reader value and cost |
| --- | --- | --- | --- |
| `CharacterRecord` | Not extracted directly. | Unknown. A base-type query also returns NPC and Player records [records]. | Can connect character data, volumes, homes, factions, relationships, quests, and AI targets. Can add no rows because concrete authored records are not proven. |
| `NPCTeleportPointRecord` | Candidate. | Unknown. The subtable is not declared in source [records]. | AI consumes these positions as NPC destinations. A page or map point can connect movement to authored world points. |
| `VolumeRecord` | Candidate with a duplication check. | Unknown [records]. | Ownership, keys, public state, and geometry can connect characters, factions, and AI areas. Compare it with published location volumes. |
| `PlayerRecord` | Deliberately excluded. | Unknown. The game normally holds the player record [records]. | It stores runtime character and save state. It is not authored world content. |
| `LocationRecord` | Deliberately excluded. | Unknown [records]. | The subclass adds no fields or reader-facing use. Published locations come from `LocationAsset`. |
| `SORecord` | Deliberately excluded. | Unknown [records]. | It wraps an arbitrary Unity `ScriptableObject`. It has no stable reader-facing content. |

`NPCRecord` and `PortalRecord` already cover 314 and 33 rows respectively [snapshot]. The serialized master-table asset is not in this repository. No serialized asset lists the dictionary membership. The complete live table inventory and every unextracted record count therefore need a live probe [records]. The three source-known subtables are not the complete inventory.

The accessors add cost even in this cheap group. `CharacterRecord.StoredCharacterData` calls `Init` before it returns. `NPCRecord.SpawnPoint` writes its transformed value into a cache when the public getter runs, so the extractor reads its backing field. `CharacterData.CharName` creates a random name when the stored name is blank in play mode. A base-type `GetRecords(Type)` query includes derived records. These behaviors can change output or add rows during a probe [records, fields].

### Authored definition assets

`BuiltLookupTable.GetAssetsOfType` can enumerate several missing families. `namedAsset` can find assets that the lookup table does not register. The current extractors do not cover these candidates.

| Candidate | Measured count | Source path or identity | Coverage state |
| --- | ---: | --- | --- |
| `ItemListAsset` and counted or leveled wrappers | 348 [obtainability] | `BuiltLookupTable` call sites [assets] | Not extracted. Nested weighted lists can create item provenance edges. |
| `EnchantmentData` | 64 [snapshot] | `BuiltLookupTable` call site [assets] | Not extracted. It can connect equipment to enchantments and effects. |
| `PotionRecipe` | 48 [snapshot] | `BuiltLookupTable` call site [assets] | Not extracted. Recipe pages can connect tags, ingredients, and produced potions. |
| `PerkAsset` | 18 [snapshot] | `BuiltLookupTable` [assets] | Not extracted. It can connect characters to perks. |
| `TraitType` | 17 [snapshot] | `BuiltLookupTable` [assets] | Not extracted. It can connect characters to traits. |
| `QuestData` | 13 [obtainability, tile] | Authored asset with Odin graph data | The definition is known. Its graph payload is in the expensive group below. |
| `JournalEntryAsset` | Unknown [assets] | No enumeration call site found [assets] | Investigate only with a live probe. |
| `MerchantCategory` | 0 live rows [snapshot] | Authored category type [assets] | No current data exists to extract. Character merchant lists remain unmodelled. |
| `FastTravelSetAsset`, `CharClass`, `NameSet`, `RaceGroup`, `DamageType`, `SpellContainer` | Unknown [assets] | No enumeration call site found [assets] | Do not claim coverage or counts without a live probe. |

The item audit also records merchant stock, NPC inventory, enemy inventory, quest rewards, graph grants, recipe learning, and potion crafting as unmodelled provenance paths [obtainability]. Their authored fields are accessible at different costs. The current `CharacterData` pages do not publish merchant inventories.

### Odin graphs and streamed scenes

Odin graph data is present after the game loads it. Reflection over serialized fields alone does not prove that this data is absent [obtainability]. `QuestData` holds phases, objectives, events, rewards, journal text, graph objects, and character or location quest objects. `AddItemListNode` and `ItemsQuestReward` hold item grants [scene]. `DialogFlowGraph` assets attach to characters and quests. Dialog graph references can name NPCs, players, custom targets, quest objects, and `CharacterRecord` targets [scene].

Dialogue and quest extraction must preserve authored branches and conditions. It must not simulate dialogue choices, quest progress, loot rolls, or AI behavior. Runtime substitutions, player names, weather, and blackboard values are not authored facts [scene].

Scene-only content is the other expensive group. `Container` has no record-backed identity. `ItemSpawner`, `InteractableItemSpawner`, and `ItemPickup` are scene components. `DeadBodyContainer` derives from `Container`. `Door` implements `IInstanceRecordSceneObject` and exposes portal data, so portal records are not part of this scene-only gap [scene]. A start-area probe found 57 containers, 185 item spawners, and 178 free pickups [obtainability, tile]. The world streams through 683 cells [obtainability, tile]. A complete enumeration must load and unload cells, preserve state, and account for rerolls and persistence [obtainability, tile].

The same world traversal supports scene enumeration and tile capture. Tile capture also needs terrain bounds, dynamic-content suppression, reproducibility, and checksums [tile]. The tile specification owns tile design. This audit records only the shared coverage cost.

## What we deliberately will not extract

These exclusions record negative findings so that later audits do not repeat them.

- `TutorialAsset` is UI sidebar or popup material. It is not world content [assets].
- `PlayerRecord` is runtime player and save state. It is not authored reference content [records].
- `LocationRecord` has no type-specific fields or reader-facing use. `LocationAsset` already supplies location entities [records].
- `SORecord` wraps arbitrary Unity assets. It has no stable public shape [records].
- `PortalRecord.isAccessable` is read only by `Copy()`. All 33 current portal rows are `true`, and the field does not control traversal [fields, snapshot].
- `MasterSpellListAsset`, `MasterPotionListAsset`, `ArdenfallMasterData`, and similar catalogs are private configuration. Keep them private unless a field creates a public edge [assets].
- The decompiled namespace contains 146 ScriptableObject or SerializedScriptableObject classes. Most are technical infrastructure, so the compendium excludes them as a group [assets].
- `ItemFilter` is a reusable internal predicate, not a taxonomy [survey].
- Reputation and bounty are runtime state on `FactionInstance`. Only authored `Faction` data belongs in this model [survey].
- `CharacterRace`, `CharacterModule`, and the race-list selector are mainly rendering and AI configuration. They are not reader-facing entity families [survey].
- No gameplay class for harvest, gathering, resource nodes, or breakable resources appeared in the source search. Foliage classes only render trees and grass [scene].
- Enchanting mutates an existing equipment item. It does not create an item. Repair changes durability in place. `ItemConverter` has no call site [obtainability].
- No cooking, smithing, disassembly, salvage, or upgrade system exists in the checked game builds [obtainability].
- Quest progress, dialogue state, container taken state, merchant restock state, save-dependent outcomes, and player actions are runtime results. They are not authored extraction facts [obtainability, scene].
- The spell emitter skips `SoundsSpellEffect`, `SubTooltipSpellEffect`, and `TargetAIValueSpellEffect`. These carry audio, tooltip plumbing, and AI weighting, not reader-facing spell mechanics [fields].
- Visual and audio implementation fields that give readers no content are excluded. Editor test controls and fields without game consumers are excluded for the same reason [fields].

`VolumeRecord` is not a final exclusion. The records audit ranks it as a candidate because it can connect owners, factions, keys, and AI areas. The earlier program survey calls it unrelated to the location polygons and records it as deliberately not an entity [records, survey]. This audit keeps the status unresolved until a live comparison proves duplication or distinct reader value.

## What we drop from the families we already cover

The current snapshot emits only the existing columns. It cannot show the distribution of omitted fields. Each field below needs a live probe before the compendium states its variation [fields]. The groups describe reader value, not extraction order.

### Fields that create links

These fields can name other authored entities or references. The decompiled types prove the reference shape. A live probe must establish which rows contain values.

- `CharacterData.traits`, `perks`, `characterClass`, `startingAttributes`, `majorSkills`, `damageTypeResistances`, `itemLists`, `additionalItems`, `modules`, `statusEffects`, and `abilities` can link characters to traits, perks, classes, stats, item lists, items, and status effects [fields].
- `SpellData.spellEffectReference` and `subSpells` can link spells to status effects or other spells [fields]. The survey measured 81 effect objects across 56 spells, 17 effect classes, and 5 sub-spells. It also measured 27 status-effect references across 25 status effects. Thirteen status-effect pages gained their first link [survey].
- `StatusEffectData.effects` and `modifyStatusEffects` can link one status effect to another [fields].
- `Faction.autoAddFactions` can link factions to factions [fields].
- `FactionItemTag.modifiers` can link item tags to factions [fields].
- Item variant `bleedStatusEffect` fields can link items to status effects [fields].
- NPC embedded `CharacterData` has no stable authored id. It cannot safely link an NPC record to a character page [records, fields].

`CharacterData.startingFactions` already creates character-to-faction links. It is not a missing field [snapshot, survey].

### Fields that add reader content

These fields can add facts to an existing page. Their expected content comes from game behavior, but their row-level variation needs a live probe.

- Character data can add traits, perks, class, starting attributes, major skills, resistances, starting money, merchant inventory, merchant additions, merchant gold, supported trade discounts, and fast-travel sets [fields].
- Spell data can add AI mode and type, three cooldowns, an AI multiplier, generation controls, and sub-spells [fields].
- Status effects can add negative or disease flags, minimum level, life mode, effect data, status modifications, and potion-generation data [fields].
- Item variants can add combat values, armor rating, enchantments, equipment slots, resistances, status references, and spell references [fields].
- `LocationAsset.displayOnEnterVolume` can add location-entry behavior to a location page [fields].

### Fields that only complete the model

These fields improve fidelity without creating a useful new page or relationship. Their variation still needs a live probe unless a source already measures it.

- Character data can add age, gender, race, experience on kill, fist item, AI packages, actions, dialogue graphs, attack graphs, boss health bars, dead-body persistence, offline AI, pickpocket status, merchant flags, training stats, and fast-travel sets [fields].
- Spell data can add cast sounds, hand-object and color controls, and generation booleans [fields].
- Status effects can add particle, audio, and skin controls [fields].
- `Faction.bountyPrisonPosition` can complete faction data [fields].
- `LocationAsset.locationID` can complete location identity [fields].
- Base item data can add pickup meshes, inventory visuals, pickup audio, and the direct `tags` field. Tags already project into `tagged` edges, so the direct field adds no new link [fields].
- NPC records can add `customFriendlyID`, owned volumes, home volume, and embedded character data [fields].
- `PortalRecord.isAccessable` stays excluded. `Copy()` is its only consumer, and all 33 current values are `true` [fields, snapshot].

The accessor rules remain part of the field cost. `CharacterRecord.StoredCharacterData` initializes its result. `NPCRecord.SpawnPoint` mutates its cache through the public getter. `CharacterData.CharName` invents a random name for a blank stored value. A probe must read stable backing data and record these effects [records, fields].

## Ranked judgement by reader value

Reader value follows connectivity, not candidate size.

1. **Dialogue graphs rank first.** They can name characters and placed characters, which account for 526 pages with no inbound link [survey]. They can also connect quests through attached quest data. Their cost is medium to high because authored branches and conditions must remain intact [scene].
2. **Quest definitions rank second.** A live probe counts **38** quests, not the 13 the earlier documents record. 13 is the number registered in `BuiltLookupTable`, so identity is `namedAsset` rather than `lookupAsset`. All 88 character quest objects resolve to placed-character record ids, which is the link the first item also chases [probe].
3. **Authored item provenance ranks third.** The 728 item pages without an inbound link need loot lists, recipes, merchants, or quests. `ItemListAsset` has 348 measured candidates, and its nested groups can connect many currently isolated items [survey, obtainability].
4. **World scene enumeration ranks fourth.** It can add found-in and obtainability links for containers, spawners, and pickups, but it requires a traversal of 683 streamed cells and explicit persistence handling [obtainability, tile].
5. **`NPCTeleportPointRecord` and `VolumeRecord` remain conditional candidates.** They can create high-value movement, ownership, faction, and AI links, but their live counts are unknown [records].

The reports use different ranking lenses. The authored-asset audit ranks `ItemListAsset` first for item provenance. The scene-graph audit ranks quests first because they connect several entity families. This audit ranks by the pages and links that readers currently cannot reach. The records and program surveys also disagree on `VolumeRecord`, as recorded above.
