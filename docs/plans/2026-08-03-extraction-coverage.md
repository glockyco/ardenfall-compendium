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
- **[live-run]** Ardenfall Demo `0.0.10.91`, measured 2026-08-15 against the live export.

## Live run evidence, 2026-08-15

The live run settles the current family counts. It reports 1,273 items, 212 character definitions, 292 published placements, 48 locations, 33 portals, 48 factions, 38 quests, 56 spells, 64 enchantments, 48 potion recipes, 172 status effects, 28 item tags, 7 item categories and 21 stat types.

| Family | Live rows |
| --- | ---: |
| `item` | 1,273 |
| `character` | 212 |
| `npc` placements | 292 |
| `location` | 48 |
| `portal` | 33 |
| `faction` | 48 |
| `quest` | 38 |
| `spell` | 56 |
| `enchantment` | 64 |
| `potion-recipe` | 48 |
| `status-effect` | 172 |
| `item-tag` | 28 |
| `item-category` | 7 |
| `stat-type` | 21 |

The live diagnostic totals are:

| Diagnostic | Count |
| --- | ---: |
| `itemFontRefMissing` | 65 |
| `characterNameMissing` | 59 |
| `npcDisplayNameMissing` | 33 |
| `statusEffectNameMissing` | 18 |
| `sourceYieldedDuplicateRecord` | 6 |
| `questCharacterDialogueGraphEmpty` | 4 |
| `connectedPortalMissing` | 3 |
| `characterRaceMissing` | 3 |
| `itemIconRefMissing` | 2 |
| `factionNameMissing` | 2 |
| `spellNameMissing` | 1 |
| `portalFriendlyNameMissing` | 1 |
| `nullAsset` | 1 |

The `instances` master-record table yields 320 NPC rows but only 314 distinct `RecordID` values. Six repeated-id pairs are distinct objects (`ReferenceEquals` is false), and both objects report `IsEditorCreated() == true`. The repeated objects carry identical data, so extraction drops the repeats and emits `sourceYieldedDuplicateRecord` instead of failing. It then filters the 22 runtime-created records. The accounting is 320 source rows minus six repeats minus 22 runtime-created records, which produces 292 published placements. A `RecordID` is not unique in the game's own table.

All 48 locations are enabled, and none is debug-only. Of the 38 quests, 16 are disabled and 11 are hidden from the quest UI. These flags describe authored state; they do not suppress the rows.

## What the game holds and the compendium covers

The compendium models twelve families in the [snapshot]. The 2026-08-03 release ships 17 item variants. The identity mechanism names the source used for the public row id.

| Family | Rows | Identity mechanism | What the row represents |
| --- | ---: | --- | --- |
| `item` | 1,273 [live-run] | `lookupAsset` | An authored `ItemData` asset. |
| `item-variant` | 17 [snapshot] | `variantId` | A descriptor-defined concrete item type. |
| `item-category` | 7 [live-run] | `namedAsset` | An `ItemCategory` asset found by its stable name. |
| `item-tag` | 28 [live-run] | `lookupAsset` | An authored `ItemTag` asset. |
| `stat-type` | 21 [live-run] | `namedAsset` | A `StatType` asset found by its stable name. |
| `spell` | 56 [live-run] | `namedAsset` | `SpellData` assets found by their stable name. |
| `status-effect` | 172 [live-run] | `lookupAsset` | An authored `StatusEffectData` asset. |
| `faction` | 48 [live-run] | `lookupAsset` | An authored `Faction` asset. |
| `location` | 48 [live-run] | `lookupAsset` | An authored `LocationAsset`. |
| `character` | 212 [live-run] | `namedAsset` | An authored `CharacterData` asset found by its stable name. |
| `npc` | 292 [live-run] | `record` | A published placed `NPCRecord`; the live table has 320 rows and 314 distinct `RecordID` values before duplicate and runtime filtering. |
| `portal` | 33 [live-run] | `record` | A placed `PortalRecord` with a `RecordID`. |

The roadmap table predates the `CharacterExtractor` identity change. It labels `CharacterData` as `lookupAsset`. The extractor uses `namedAsset`, which is authoritative [fields].

The 2026-08-03 release materializes 2,266 detail pages. A rendered-detail measurement finds 1,379 pages with no inbound link from another detail page [survey]. The unlinked pages include 726 items, 252 NPCs, 212 characters, 103 status effects, 22 factions, 20 locations, 17 stat types, 12 quests, 10 item tags, 4 portals, and 1 spell [survey].

The 2026-08-03 release also extracts 38 `QuestData` rows with graph-backed read models.

### Item inheritance is covered, world provenance is not

Item and character snapshots now carry `parentRef`, and canonical rows carry `items.parent_ref_json` and `characters.parent_ref_json`. The item relation covers **1,238 of 1,273** items with a parent and the character relation covers **210 of 212** definitions. The item read model also classifies the 73 unpublishable prototype names and resolves chain-matched relationships as described in [`2026-08-04-item-character-inheritance`](2026-08-04-item-character-inheritance.md).

This does not extract item provenance from streamed world content. An earlier measurement called the work a **683-cell** walk; that figure was wrong because it counted `CellData` assets as loadable scenes. The build holds 33 scenes, of which 27 are cell scenes (24 overworld and 3 interior), against 607 `CellData` assets. `LoadSceneAsync` returns null for the other 580 assets. Loading all 27 cell scenes additively, three at a time, takes about two and a half minutes; 15 scenes hold content. The **278** items behind **182** scene-owned item lists therefore require those 27 loadable scenes. Inheritance extraction does not change that traversal or its cost.

## What the game holds and the compendium does not cover

The missing content falls into three groups. The groups have different extraction costs.

### Record types in the master record table

This is the lowest-cost group because the `instances` record source works. `MasterRecordTable` owns an arbitrary dictionary of table wrappers. `GetRecords(Type)` visits each named table, and `RecordTable.GetRecords(Type)` includes subclasses through `IsAssignableFrom` [records]. The instances wrapper scans every map cell, so all present `InstanceRecord` subclasses are reachable [records].

| Record type | Current status | Known count or limit | Reader value and cost |
| --- | --- | --- | --- |
| `CharacterRecord` | Extracted through the `instances` table as published placements. | 320 rows, 314 distinct `RecordID` values, 292 published after six identical repeats and 22 runtime records are filtered [live-run]. | Connects character data, volumes, homes, factions, relationships, quests and AI targets. |
| `NPCTeleportPointRecord` | Candidate. | Unknown. The subtable is not declared in source [records]. | AI consumes these positions as NPC destinations. A page or map point can connect movement to authored world points. |
| `VolumeRecord` | Candidate with a duplication check. | Unknown [records]. | Ownership, keys, public state, and geometry can connect characters, factions, and AI areas. Compare it with published location volumes. |
| `PlayerRecord` | Deliberately excluded. | Unknown. The game normally holds the player record [records]. | It stores runtime character and save state. It is not authored world content. |
| `LocationRecord` | Deliberately excluded. | Unknown [records]. | The subclass adds no fields or reader-facing use. Published locations come from `LocationAsset`. |
| `SORecord` | Deliberately excluded. | Unknown [records]. | It wraps an arbitrary Unity `ScriptableObject`. It has no stable reader-facing content. |

`NPCRecord` and `PortalRecord` cover 292 published placements and 33 portals respectively [live-run]. The live master-record table has exactly one table, `instances`, with 320 NPC rows and 314 distinct `RecordID` values. Six repeated-id pairs are distinct objects (`ReferenceEquals` is false), both report `IsEditorCreated() == true`, and their data is identical. The extractor emits `sourceYieldedDuplicateRecord` and drops the repeats rather than failing. It then filters the 22 runtime-created records, producing 292 published placements. A `RecordID` is not unique in the game's own table.

The accessors add cost even in this cheap group. `CharacterRecord.StoredCharacterData` calls `Init` before it returns. `NPCRecord.SpawnPoint` writes its transformed value into a cache when the public getter runs, so the extractor reads its backing field. The `CharacterData.CharName` getter generates a name from the race and writes it back when play mode reads an empty stored name, so the extractor reads the backing `charName` field. A base-type `GetRecords(Type)` query includes derived records. These behaviors can change output or add rows during a probe [records, fields].

### Authored definition assets

`BuiltLookupTable.GetAssetsOfType` can enumerate authored families. `namedAsset` can find assets that the lookup table does not register. The table records which families the live export covers and which candidates remain.

| Candidate | Measured count | Source path or identity | Coverage state |
| --- | ---: | --- | --- |
| `ItemListAsset` and counted or leveled wrappers | 348 loaded assets reaching 811 distinct items [obtainability] | `BuiltLookupTable` call sites [assets] | The 530 reached from `CharacterData.itemLists` are exactly the 530 already published by `can_drop` edges. The other 278 items sit behind 182 lists with no at-rest asset references and require the 27 loadable cell scenes. The earlier 683-cell estimate counted `CellData` assets that have no scene. |
| `EnchantmentData` | 64 [live-run] | `BuiltLookupTable` call site [assets] | Extracted as authored enchantment rows. It connects equipment to enchantments and effects. |
| `PotionRecipe` | 48 [live-run] | `BuiltLookupTable` call site [assets] | Extracted as authored recipe rows. Recipe pages connect tags, ingredients and produced potions. |
| `PerkAsset` | 18 [snapshot] | `BuiltLookupTable` [assets] | Not extracted. It can connect characters to perks. |
| `TraitType` | 17 [snapshot] | `BuiltLookupTable` [assets] | Not extracted. It can connect characters to traits. |
| `JournalEntryAsset` | Unknown [assets] | No enumeration call site found [assets] | Investigate only with a live probe. |
| `MerchantCategory` | 0 standalone live rows [snapshot] | Authored category type [assets] | This definition-asset count does not measure placement fields: 23 placements configure `merchantCategories`, and the placement values remain to be published. |
| `NameSet` | 7 distinct assets used by 13 races with player-visible names and name sets [live-run] | `CharacterRace` name-set references | Extract as shared naming vocabulary with ordered set references and authored seeds. |
| `FastTravelSetAsset`, `CharClass`, `RaceGroup`, `DamageType`, `SpellContainer` | Unknown [assets] | No enumeration call site found [assets] | Do not claim coverage or counts without a live probe. |

At-rest owner measurements prevent several declarations from being mistaken for populated provenance sources:

| Declared owner | Live result | Meaning |
| --- | --- | --- |
| `CharacterData.itemLists` | 530 reachable items | These are exactly the 530 items already published by `can_drop` edges. This owner adds no new item reachability. |
| `CharacterData.merchantItemLists` | 14 placements | The master record table has 14 placements with `merchantItemLists`, 8 with `merchantAdditionalItems`, 28 with `merchantGold`, and 23 with `merchantCategories`; all are reachable without a world walk. |
| `MasterPotionListAsset` | 0 loaded instances | This catalog is absent at rest. |
| `MasterSpellListAsset` | 0 loaded instances | This catalog is absent at rest. |
| `CharacterItemGroup` | 0 entries | No authored owner entries exist at rest. |
| `CharacterModule.itemLists` | 0 entries | No authored owner entries exist at rest. |

The 348 `ItemListAsset` figure is a count of loaded assets, not a count of new provenance opportunities. Its 530-item character path is already published, and its remaining 278 items are behind 182 lists with no at-rest asset references. Those lists are scene-owned and require the same 27 loadable cell scenes as world scene enumeration. The earlier 683-cell estimate counted `CellData` assets without scenes, so it overstated the traversal. Authored item provenance and the world walk are one slice, not two rankable slices.

The cheap authored additions are the standalone asset types. `PotionRecipe` has 48 assets and reaches 127 currently unlinked items. `EnchantmentData` has 64 assets and reaches 19 currently unlinked items. Together they give 158 currently unreachable item pages a first inbound link and add 112 pages of their own without a world walk.

The item audit records merchant stock, NPC inventory, enemy inventory, quest rewards, graph grants, recipe learning, and potion crafting as potential provenance paths [obtainability]. Their authored fields are accessible at different costs. Placement leaves set `merchantItemLists`, `merchantAdditionalItems`, `merchantGold` and `merchantCategories`; the live counts are 14, 8, 28 and 23 respectively. These placement-owned merchant values remain separate from `CharacterData` definition values.

### Odin graphs and streamed scenes

Odin graph data is present after the game loads it. Reflection over serialized fields alone does not prove that this data is absent [obtainability]. `QuestData` holds phases, objectives, events, rewards, journal text, graph objects, and character or location quest objects. `AddItemListNode` and `ItemsQuestReward` hold item grants [scene]. `DialogFlowGraph` assets attach to quest character objects and to scene interactables, not to `CharacterData` [probe]. Dialog graph references can name NPCs, players, custom targets, quest objects, and `CharacterRecord` targets [scene].

Dialogue and quest extraction must preserve authored branches and conditions. It must not simulate dialogue choices, quest progress, loot rolls, or AI behavior. Runtime substitutions, player names, weather, and blackboard values are not authored facts [scene].

Scene-only content is the other expensive group. `Container` has no record-backed identity. `ItemSpawner`, `InteractableItemSpawner`, and `ItemPickup` are scene components. `DeadBodyContainer` derives from `Container`. `Door` implements `IInstanceRecordSceneObject` and exposes portal data, so portal records are not part of this scene-only gap [scene]. A start-area probe found 57 containers, 185 item spawners, and 178 free pickups [obtainability, tile]. An earlier **683-cell** traversal estimate was wrong: the build has 33 scenes, 27 of them cell scenes (24 overworld and 3 interior), and 607 `CellData` assets, of which 580 have no scene and return null from `LoadSceneAsync`. Loading all 27 cell scenes additively, three at a time, took about two and a half minutes; 15 hold content. A complete enumeration must load and unload those scenes, preserve state, and account for rerolls and persistence [obtainability, tile].

The same world traversal supports scene enumeration and tile capture. Tile capture also needs terrain bounds, dynamic-content suppression, reproducibility, and checksums [tile]. The tile specification owns tile design. This audit records only the shared coverage cost.

## What we deliberately will not extract

These exclusions record negative findings so that later audits do not repeat them.

- `TutorialAsset` is UI sidebar or popup material. It is not world content [assets].
- `PlayerRecord` is runtime player and save state. It is not authored reference content [records].
- `LocationRecord` has no type-specific fields or reader-facing use. `LocationAsset` already supplies location entities [records].
- `SORecord` wraps arbitrary Unity assets. It has no stable public shape [records].
- `PortalRecord.isAccessable` is read only by `Copy()`. All 33 current portal rows are `true`, and the field does not control traversal [fields, snapshot].
- `MasterSpellListAsset`, `MasterPotionListAsset`, `ArdenfallMasterData`, and similar catalogs are private configuration. A live probe measured zero loaded instances for the two master list asset types at rest. Keep them private unless a field creates a public edge [assets].
- The decompiled namespace contains 146 ScriptableObject or SerializedScriptableObject classes. Most are technical infrastructure, so the compendium excludes them as a group [assets].
- `ItemFilter` is a reusable internal predicate, not a taxonomy [survey].
- Reputation and bounty are runtime state on `FactionInstance`. Only authored `Faction` data belongs in this model [survey].
- `CharacterRace` is a reader-facing entity because its authored name sets supply the naming vocabulary for every character type. The live run resolves a race for all 116 humanoid definitions and 93 of 96 creature definitions. Exactly three definitions have no race, one authoring omission chain: `base_creature` → `mon_ato` → `mon_ato-baby`; `enableComplexRace` is false and `simpleRace` is unset through the chain. `CharacterModule` and the race-list selector remain rendering and AI configuration. A live probe measured zero entries in `CharacterModule.itemLists` at rest, so it is not a populated authored owner [live-run, survey].
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
- `SpellData.spellEffectReference` and `subSpells` can link spells to status effects or other spells [fields]. The release projects 26 spell-sourced `applies` edges to 25 status effects, alongside the 266 item-sourced edges [snapshot].
- `StatusEffectData.effects` and `modifyStatusEffects` can link one status effect to another [fields].
- `Faction.autoAddFactions` can link factions to factions [fields].
- `FactionItemTag.modifiers` can link item tags to factions [fields].
- Item variant `bleedStatusEffect` fields can link items to status effects [fields].
- **The placement copy links to its definition.** `ScriptableObjectWrapper` gives the embedded copy a Unity clone name such as `preset_sapper_stage1(Clone)(Clone)`, but its `parent` identifies the authored definition. The live export publishes 292 placements with that definition relation [live-run, records, fields].

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

The accessor rules remain part of the field cost. `CharacterRecord.StoredCharacterData` initializes its result. `NPCRecord.SpawnPoint` mutates its cache through the public getter. `CharacterData.CharName` is `if (Application.isPlaying && charName.Get().name == "") charName.Set(new CharacterRandomName(Race)); return charName?.Get()?.name ?? "Missing Name";`: play mode generates from the race and writes the result into the definition. The extractor reads backing `charName` instead. `CharacterRandomName.Generate` returns `[No Sets]` for a race with no name sets. A definition with no race and no authored name cannot use this path because the generating constructor dereferences the null race; the affected chain is `base_creature` → `mon_ato` → `mon_ato-baby`. Neither `[No Sets]` nor `Missing Name` is a player-facing compendium name [records, fields, live-run].

## Ranked judgement by reader value

Reader value follows connectivity, not candidate size.

1. **Dialogue is extracted, and it came from a different owner than this audit assumed.** Dialogue does not hang off characters. `CharacterData.characterGraphs` holds character behaviour: a live probe measured 195 of its 196 containers as plain `ObjectFlowGraph` and exactly one `DialogFlowGraph`. The authored dialogue hangs off `CharacterQuestObject.dialogGraph.flowGraph`, on 82 of 88 quest character objects. The shipped export carries **484 lines, 292 greetings and 192 topics, across 26 quests and 58 speakers**, with 78 `speaks_about_quest` edges [probe].

   The scene-side half is not extracted. An earlier probe measured `SimpleDialogInteractable.dialogs` as 0 at rest because it did not load the cell scenes. There are 25 such interactables across the authored cells. They require the 27 loadable cell scenes described above, not the earlier 683-cell estimate. Free-standing dialogue on characters who appear in no quest stays unreachable with it.
2. **Quest definitions rank second.** A live probe counts **38** quests, and the release ships them as named assets with graph-backed read models. All 88 character quest objects resolve to placed-character record ids, which is the link the first item also chases [probe].
3. **Authored item provenance and world scene enumeration are one slice.** The 348 `ItemListAsset` figure counts loaded assets reaching 811 distinct items, not new opportunities. The 530 items reached from `CharacterData.itemLists` are exactly the 530 already published by `can_drop` edges. The other 278 items sit behind 182 lists with no at-rest asset references and require the same 27 loadable cell scenes as containers, spawners, and pickups. The earlier 683-cell estimate counted `CellData` assets without scenes and overstated the cost.
4. **Standalone potion recipes and enchantments are authored families.** The live run publishes 48 `PotionRecipe` rows and 64 `EnchantmentData` rows without a world walk.
5. **`NPCTeleportPointRecord` and `VolumeRecord` remain conditional candidates.** They can create high-value movement, ownership, faction, and AI links, but their live counts are unknown [records].

The reports use different ranking lenses. Standalone potion recipes and enchantments are now authored families, while `ItemListAsset` provenance and world scene enumeration share one traversal of the 27 loadable cell scenes. The scene-graph audit ranks quests first because they connect several entity families. This audit ranks by the pages and links that readers currently cannot reach. The records and program surveys also disagree on `VolumeRecord`, as recorded above.
