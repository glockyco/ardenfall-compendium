## Context

Every number here was measured against Ardenfall Demo `0.0.10.91` between 2026-08-08 and 2026-08-15, by reading the decompiled assembly in `.decompiled/steam-22145060-63c576261184/` or by probing the running game over HotRepl. The published baseline is the live export `snapshots/snapshots/0.0.10.91-20260815-0707496801550`.

**The game has one authored object system.** `ItemData`, `CharacterData`, `CharacterRace`, `CharacterModule`, `Region`, `Weather` and `CreatureData` all extend `ParameterizedObject`, whose `parent` is a prototype reference and whose `Parameter<T>.Get()` resolves a value up the chain until a node has it set (`Ardenfall/ParameterizedObject.cs:11-16`, `Ardenfall/Parameter.cs:142-166`).

**A placed record is a node in that same chain.** `CharacterRecord.characterData` is a `ScriptableObjectWrapper`, which is a copy rather than a reference: it stores `serializedType`, `serializedName` and every field whose value is not an unset `Parameter`, then rebuilds the object with `ScriptableObject.CreateInstance` (`Ardenfall/Utility/ScriptableObjectWrapper.cs`). The copy's own asset name is a Unity clone name such as `preset_sapper_stage1(Clone)(Clone)`, which is why the link to its definition looked impossible. Its `parent` is the authored definition. The master record table has one table, `instances`, which yields 320 NPC records but only 314 distinct `RecordID` values. Six rows repeat an id already seen; each repeat is a distinct object (`ReferenceEquals` is false), and both objects report `IsEditorCreated() == true`. The repeat objects carry identical data, so the export drops those rows and publishes 292 placements after filtering the 22 runtime-created records. The remaining placements link to their authored definitions through `parent`.

**The leaf carries authored data of its own.** The editor-created source rows set parameters on the placement leaf itself, including:

| parameter set on the placement                  | placements |
| ----------------------------------------------- | ---------: |
| `charName`                                      |        218 |
| `startingFactions`                              |         84 |
| `additionalItems` / `itemLists`                 |    33 / 11 |
| `merchantGold` / `merchantCategories`           |    28 / 23 |
| `merchantItemLists` / `merchantAdditionalItems` |     14 / 8 |
| `startingLevel`                                 |         32 |
| `characterGraphs`                               |        140 |

`CharacterData.merchantItemLists` is set on placement leaves in the master record table, so merchant inventory is reachable without a world walk. The live source also records placement-owned `merchantAdditionalItems`, `merchantGold` and `merchantCategories` values.

**Names.** `CharacterData.CharName` is the player-facing accessor (`Ardenfall/CharacterData.cs:165-183`). Its getter is `if (Application.isPlaying && charName.Get().name == "") charName.Set(new CharacterRandomName(Race)); return charName?.Get()?.name ?? "Missing Name";`. When play mode reads an empty stored name, the getter generates a name from `Race` and writes it back into the definition. The extractor therefore reads the backing `charName` field, not `CharName`, so extraction does not mutate the data it reads. `CharacterRecord.customFriendlyID` appears only in `Debug.LogError`, ImGui debuggers and editor labels; `GetFriendlyName()` composes `customFriendlyID(CharName)` for those same surfaces.

`CharacterRandomName.Generate` joins one generated word per name set in name-set order. It returns the literal `[No Sets]` when the race has no name sets. The `CharName` getter returns `Missing Name` when no name resolves. Neither literal is a player-facing name for compendium presentation. A definition with no race and no authored name cannot use this game path because the generating constructor dereferences the null race. This affects the single omission chain `base_creature` → `mon_ato` → `mon_ato-baby`; `enableComplexRace` is false and `simpleRace` is unset throughout that chain.

**Authored versus runtime.** `CharacterRecord.IsEditorCreated()` returns whether the record holds a stored `ScriptableObject` (`Ardenfall/RecordSystem/CharacterRecord.cs`). The `instances` table yields 320 rows and 314 distinct `RecordID` values. Six rows repeat an existing `RecordID`; the paired objects are distinct, both authored, and carry identical data. The other 22 distinct records are runtime-created. Extraction filters those 22 runtime records and drops the six identical repeats, publishing 292 placements. A `RecordID` is therefore not unique in the game's own table; the duplicate diagnostic is non-fatal because the repeated objects agree.

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

Extraction reads the single `instances` table. It yields 320 rows with 314 distinct `RecordID` values. Six rows repeat an existing id; `ReferenceEquals` is false for each pair, both objects are authored, and their data is identical. The 22 remaining distinct records are runtime-created and have no character data. Extraction reports both filters: 320 source rows minus six identical repeats minus 22 runtime records produces 292 published placements. A repeated `RecordID` is a diagnostic, not a hard failure, because the duplicate data agrees.

This is not a visibility rule. Runtime state is already out of scope for this repository, and the game supplies the test, so the boundary is drawn where the game draws it. Extraction reports how many records it filtered so the number stays visible.

Two related accessor hazards stay avoided for the same reason: `CharacterData.CharName` generates and caches a name in play mode, so extraction reads the backing `charName` field, and `NPCRecord.SpawnPoint` writes a cache when its public getter runs, so extraction reads the backing field and falls back to the record transform.

### 4. Names resolve in a defined order, and the order is published

A display name resolves as: the value set on this row; else the value inherited from the chain; else generated at runtime from the race's name sets; else absent. The resolved state is stored, not just the string. Generated output is never replaced with `[No Sets]` or `Missing Name` in a player-facing name field.

`customFriendlyID` is an authoring label. It stays in canonical data, it is available to diagnostics and private debug views, and it never titles a page, labels a link, or appears in search.

### 5. A generated name is published as a mechanism and a vocabulary

`CharacterRandomName.Generate` walks the race's name sets in order and joins one word per set with a space (`Ardenfall/CharacterRandomName.cs:23-40`). Each word comes from `NameSet.Generate`, which trains a `Sobriquet.Generator` over a `MarkovChain` of the set's `generationOrder` on the set's authored `WeightedName` seeds, caches 100 outputs and samples them (`Ardenfall/NameSet.cs:53-98`). A race with no name sets produces the literal `[No Sets]`; this is a generator status literal, not a name.

Measured: 13 races carry both a player-visible name and name sets, over 7 distinct name-set assets. `Karu Elf` combines `nset_mystelf_female` with 361 seeds and `nset_mystelf_male` with 948, both at order 5. `Sand Elf`'s female set has 17.

So `NameSet` becomes an entity, published once and referenced by every race that uses it, with its complete seed list. The race page states the mechanism and the counts and links to the sets. A missing resolved name uses the literal `Missing Name`; neither literal may appear as a player-facing compendium name.

The generator's output is not published. Such a string would be a roll taken by this repository and would sit on the page indistinguishable from `Saya Sako`, which a designer typed. The seeds answer the reader's question better and are authored.

### 6. A character the game names at runtime is titled by description

Its title is a descriptive label composed from published facts, beginning with the nearest recognisable type, extended by the next published fact when two would collide, and marked as a description rather than a name. `Karu Elf` rather than `A Karu Elf`: a title sorts, appears as link text and lands in search results, and a leading article costs all three while adding nothing that page prose cannot say better. Listings disambiguate by containing location, and URLs by the short id the node writer already produces.

### 7. The reader-facing type is the nearest recognisable ancestor, else the race

Race is the naming vocabulary for every character type, not a humanoid-only classification. Every one of the 116 humanoid definitions resolves a race, and 93 of the 96 creature definitions resolve one. Type resolution therefore walks up the chain to the nearest node with a player-visible name and falls back to the race without branching on humanoid or creature. The three definitions with no race are one authoring omission: `base_creature` → `mon_ato` → `mon_ato-baby`. Their `enableComplexRace` is false and `simpleRace` is unset through the chain, so a definition with no authored name in this chain cannot generate a game name because `CharacterRandomName` dereferences the null race.

One rule covers all character types. The race fallback is an outcome of the chain, not an asymmetry between creatures and humanoids.

### 8. Nothing is excluded for how its name looks

An empty or template name is not evidence that content is unreachable. It is evidence that the naming mechanism must be modelled. Race supplies that vocabulary for all character types except the three-definition authoring omission chain described above.

The item prototype rule therefore also goes. `EnchantmentData.SupportsItem` matches through `HasParentInChain` and `DebugFillContainer` excludes bases by default, but identity does not depend on those behavioural filters. The live export publishes all 1,273 items and all 212 definitions, marks prototypes as templates, and states what is known about them.

This removes code rather than adding it: `instance_of` and `derives_from` need no unpublishable-target suppression, and the enchantment whitelist no longer needs descendant fan-out to avoid naming a prototype.

### 9. Availability is a separate axis from identity

`QuestManager` skips a quest whose `disabled` flag is set when it builds instances or restores state (`Ardenfall/Questing/QuestManager.cs:94, 119, 142, 171`), so the flag is an authoring switch. It is not a statement about reachability: `SetQuestVariable` logs `QUEST SYSTEM :: Referencing a disabled quest!` (`Ardenfall/Questing/Nodes/SetQuestVariable.cs:108-121`), so live graphs reference disabled quests. `hideInQuestUI` is narrower still, hiding a running quest from the journal.

Unavailable content is published and marked, with wording that states the flag rather than a conclusion. One shared notice replaces today's two shapes: a sentence on the quest overview and a `Disabled: Yes/No` row that reads `No` on 28 of 38 detail pages.

The extraction defect is on the location side. `BuiltLookupTableLocationAssetSource.cs:48` does `if (!asset.enabled) continue;`, so a disabled location never reaches the snapshot and the `Enabled` field the same source exports can never be false. All 48 locations are currently enabled, which is why it has gone unnoticed; the first build that disables one would silently drop it from the map and the canonical table.

### 10. Relationships gain an edge and lose no endpoint

`instance_of` runs from a placement to its definition, forward title `Character type`, inverse `Placements`. The inverse turns a type page into a bestiary entry: `Darvaki` lists its sightings as map deep links.

Because nothing loses a page, the 245 `found_at` edges over 193 placements and 28 locations, and the 88 `features_character` edges from quests, all keep both endpoints. No suppression, no degraded rendering, no relocated dialogue section.

### 11. Route names state the reader's model

`/characters` holds the placements, `/character-types` holds the definitions, and navigation reads `Characters` and `Character types`. `/placed-characters` and its GUID routes go. The compendium publishes only current routes: an old URL returns the site's not-found page, which already explains that a page may have existed in an earlier snapshot. Navigation exposes no extraction vocabulary.

## Risks / Trade-offs

- **Published page count rises.** Item and definition prototypes gain pages, all marked as templates. That is the honest consequence of the visibility rule, and loot references show that some template items are reachable.
- **Runtime-created records are not published.** The live filter and duplicate-yield filter make the placement export reproducible.
- **Titles repeat.** Several pages will read `Karu Elf`. That is what the game calls them, so listings must carry the location column and slugs must keep their short id.
- **Provenance widens the schema.** Every published field gains a provenance value. It is one column or one sidecar row per field, and it is the thing that stops the next "measured on the wrong object" conclusion.
- **`IsEditorCreated` is load-bearing.** If a future build authors records at runtime deliberately, the filter would hide them. The filtered count is reported on every export so the number is visible.
