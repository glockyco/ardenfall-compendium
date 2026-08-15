## Context

Every number here was measured against Ardenfall Demo `0.0.10.91` between 2026-08-08 and 2026-08-15, by reading the decompiled assembly in `.decompiled/steam-22145060-63c576261184/` or by probing the running game over HotRepl. The published baseline is the live export `snapshots/snapshots/0.0.10.91-20260815-0707496801550`.

**The game has one authored object system.** `ItemData`, `CharacterData`, `CharacterRace`, `CharacterModule`, `Region`, `Weather` and `CreatureData` all extend `ParameterizedObject`, whose `parent` is a prototype reference and whose `Parameter<T>.Get()` resolves a value up the chain until a node has it set (`Ardenfall/ParameterizedObject.cs:11-16`, `Ardenfall/Parameter.cs:142-166`).

**A placed record is a node in that same chain.** `CharacterRecord.characterData` is a `ScriptableObjectWrapper`, which is a copy rather than a reference: it stores `serializedType`, `serializedName` and every field whose value is not an unset `Parameter`, then rebuilds the object with `ScriptableObject.CreateInstance` (`Ardenfall/Utility/ScriptableObjectWrapper.cs`). The copy's own asset name is a Unity clone name such as `preset_sapper_stage1(Clone)(Clone)`, which is why the link to its definition looked impossible. Its `parent` is the authored definition in 298 of the 298 placements that carry data, across 73 definitions.

**The leaf carries authored data of its own.** 262 of those 298 placements set at least one parameter themselves:

| parameter set on the placement                  | placements |
| ----------------------------------------------- | ---------: |
| `charName`                                      |        218 |
| `startingFactions`                              |         84 |
| `additionalItems` / `itemLists`                 |    33 / 11 |
| `merchantGold` / `merchantCategories`           |    28 / 23 |
| `merchantItemLists` / `merchantAdditionalItems` |     14 / 8 |
| `startingLevel`                                 |         32 |
| `characterGraphs`                               |        140 |

`docs/plans/2026-08-03-extraction-coverage.md` records `CharacterData.merchantItemLists` as **0 entries, no merchant inventory configured at rest**, and `2026-08-02-item-obtainability.md` scoped merchant provenance out on that basis. Both measured definitions. The merchants are configured on the placements, in the master record table, reachable with no world walk.

**Names.** `CharacterData.CharName` returns the stored value and, only when `Application.isPlaying` and that value is empty, assigns `new CharacterRandomName(Race)` (`Ardenfall/CharacterData.cs:165-183`). It is what a player reads: `IDialogOwner.DialogName`, the loot container title, the pickpocket window, and the `[npc]` and `[npc_<id>]` substitutions in dialogue and journals. `CharacterRecord.customFriendlyID` appears only in `Debug.LogError`, ImGui debuggers and editor labels; `GetFriendlyName()` composes `customFriendlyID(CharName)` for those same surfaces.

153 of 212 definitions and 265 of 320 placements resolve a stored name. Of the 59 definitions that do not, 57 carry a race with a player-visible name and two name sets, so the game generates a name for every instance of them.

**Authored versus runtime.** `CharacterRecord.IsEditorCreated()` returns whether the record holds a stored `ScriptableObject` (`Ardenfall/RecordSystem/CharacterRecord.cs`). Live: 298 records are editor-created and 22 are runtime-created, the latter with no character data and no name. The baseline export published 314 placements while the table now holds 320, and the difference is entirely runtime records that spawned while the game ran.

## Goals / Non-Goals

**Goals:**

- Model the prototype chain once, and make a record a leaf of it rather than a separate family.
- Record for every published value which node set it, so ownership is data rather than a property of whichever extractor ran.
- Publish what the game presents to a player, and make any exclusion carry its evidence.
- Make an export reproducible for a given build and save.

**Non-Goals:**

- Modelling `VolumeRecord`, `NPCTeleportPointRecord`, `CreatureData` or `Region`.
- The cell-scene walk. It is a separate change, and it is 27 loadable scenes rather than the 683 the plans assume.
- Runtime state: live inventories, quest progress, and names the game rolls during play.

## Decisions

### 1. A record is extracted as a leaf of the prototype chain

One extraction path resolves a parameterized object, and a record differs only by also having a position and record-only fields such as `customFriendlyID` and `ownedVolumes`. The placement's own values therefore appear without anyone writing per-field override code, which is what made merchants, loot and factions invisible until now.

The alternative, adding merchant and loot reads to the npc extractor beside the existing definition reads, was rejected: it is the same defect repeated with a longer field list, and the next field added to `CharacterData` would be missed again.

### 2. Provenance is stored beside every resolved value

For each published field the pipeline records the resolved value and which node set it: this row, a named ancestor, or nothing. Presentation uses it to say "this merchant's stock is its own" or "these drops come from its type", and diagnostics use it to show when a build moves authorship between levels.

This replaces asking "does the definition or the instance own this?" in code. `Parameter.IsSet` is the game's own answer, so the compendium stores it rather than guessing.

### 3. Only authored content is extracted

Extraction filters records by `IsEditorCreated()`. The 22 runtime-created records are not authored content, they carry no character data, and they exist only because NPCs spawned while the exporter was connected. Publishing them made the export depend on session length, which is why the baseline holds 314 placements and the table now holds 320.

This is not a visibility rule. Runtime state is already out of scope for this repository, and the game supplies the test, so the boundary is drawn where the game draws it. Extraction reports how many records it filtered so the number stays visible.

Two related accessor hazards stay avoided for the same reason: `CharacterData.CharName` invents a name in play mode, so extraction reads the stored parameter, and `NPCRecord.SpawnPoint` writes a cache when its public getter runs, so extraction reads the backing field and falls back to the record transform.

### 4. Names resolve in a defined order, and the order is published

A display name resolves as: the value set on this row; else the value inherited from the chain; else generated at runtime from the race's name sets; else absent. The resolved state is stored, not just the string.

`customFriendlyID` is an authoring label. It stays in canonical data, it is available to diagnostics and private debug views, and it never titles a page, labels a link, or appears in search.

### 5. A generated name is published as a mechanism and a vocabulary

`CharacterRandomName.Generate` walks the race's name sets in order and joins one word per set with a space (`Ardenfall/CharacterRandomName.cs:23-40`). Each word comes from `NameSet.Generate`, which trains a `Sobriquet.Generator` over a `MarkovChain` of the set's `generationOrder` on the set's authored `WeightedName` seeds, caches 100 outputs and samples them (`Ardenfall/NameSet.cs:53-98`).

Measured: 13 races carry both a player-visible name and name sets, over 7 distinct name-set assets. `Karu Elf` combines `nset_mystelf_female` with 361 seeds and `nset_mystelf_male` with 948, both at order 5. `Sand Elf`'s female set has 17.

So `NameSet` becomes an entity, published once and referenced by every race that uses it, with its complete seed list. The race page states the mechanism and the counts and links to the sets.

The generator's output is not published. Such a string would be a roll taken by this repository and would sit on the page indistinguishable from `Saya Sako`, which a designer typed. The seeds answer the reader's question better and are authored.

### 6. A character the game names at runtime is titled by description

Its title is a descriptive label composed from published facts, beginning with the nearest recognisable type, extended by the next published fact when two would collide, and marked as a description rather than a name. `Karu Elf` rather than `A Karu Elf`: a title sorts, appears as link text and lands in search results, and a leading article costs all three while adding nothing that page prose cannot say better. Listings disambiguate by containing location, which 193 of 314 placements have, and URLs by the short id the node writer already produces.

### 7. The reader-facing type is the nearest recognisable ancestor, else the race

For a creature the definition is named and its race is not: `Darvaki`, `Ato`, `Kawamoku`. For a humanoid the race is named and the definition is not: 45 definitions resolve to `Karu Elf`. Rather than branch on creature versus humanoid, type resolution walks up the chain to the nearest node with a player-visible name and falls back to the race, which is the game's own naming authority in exactly the case where the chain has none.

One rule, no per-family branch, and the asymmetry becomes an outcome instead of a special case.

### 8. Nothing is excluded for how its name looks

An empty or template name is not evidence that content is unreachable. It is evidence that a naming mechanism has not been modelled, which is what the 57 race-named definitions proved.

The item prototype rule therefore also goes. It looked behavioural, because `EnchantmentData.SupportsItem` matches through `HasParentInChain` and `DebugFillContainer` excludes bases by default, but the baseline emits **9 `itemLootReferencesPrototype`** diagnostics: loot lists point at items we refuse to publish, which is the game saying they are obtainable. All 1,273 items and all 212 definitions are published, prototypes are marked as templates, and what we know about them is stated.

This removes code rather than adding it: `instance_of` and `derives_from` need no unpublishable-target suppression, and the enchantment whitelist no longer needs descendant fan-out to avoid naming a prototype.

### 9. Availability is a separate axis from identity

`QuestManager` skips a quest whose `disabled` flag is set when it builds instances or restores state (`Ardenfall/Questing/QuestManager.cs:94, 119, 142, 171`), so the flag is an authoring switch. It is not a statement about reachability: `SetQuestVariable` logs `QUEST SYSTEM :: Referencing a disabled quest!` (`Ardenfall/Questing/Nodes/SetQuestVariable.cs:108-121`), so live graphs reference disabled quests. `hideInQuestUI` is narrower still, hiding a running quest from the journal.

Unavailable content is published and marked, with wording that states the flag rather than a conclusion. One shared notice replaces today's two shapes: a sentence on the quest overview and a `Disabled: Yes/No` row that reads `No` on 28 of 38 detail pages.

The extraction defect is on the location side. `BuiltLookupTableLocationAssetSource.cs:48` does `if (!asset.enabled) continue;`, so a disabled location never reaches the snapshot and the `Enabled` field the same source exports can never be false. All 48 locations are currently enabled, which is why it has gone unnoticed; the first build that disables one would silently drop it from the map and the canonical table.

### 10. Relationships gain an edge and lose no endpoint

`instance_of` runs from a placement to its definition, forward title `Character type`, inverse `Placements`. The inverse turns a type page into a bestiary entry: `Darvaki` lists its sightings as map deep links.

Because nothing loses a page, the 245 `found_at` edges over 193 placements and 28 locations, and the 88 `features_character` edges from quests, all keep both endpoints. No suppression, no degraded rendering, no relocated dialogue section.

### 11. Route names state the reader's model

`/characters` holds the placements, `/character-types` holds the definitions, and navigation reads `Characters` and `Character types`. `/placed-characters` and its GUID redirects go, and every moved page keeps a redirect from its old canonical slug, because those URLs ship in a sitemap.

## Risks / Trade-offs

- **Published page count rises.** 84 item prototypes and 59 definition prototypes gain pages, all marked as templates. That is the honest consequence of the visibility rule, and the loot references show at least 9 of the item ones are reachable.
- **16 pages disappear**, the runtime-created records the baseline happened to capture. This is the only removal, and it is what makes the export reproducible.
- **Titles repeat.** Several pages will read `Karu Elf`. That is what the game calls them, so listings must carry the location column and slugs must keep their short id.
- **Provenance widens the schema.** Every published field gains a provenance value. It is one column or one sidecar row per field, and it is the thing that stops the next "measured on the wrong object" conclusion.
- **`IsEditorCreated` is load-bearing.** If a future build authors records at runtime deliberately, the filter would hide them. The filtered count is reported on every export so the number is visible.
