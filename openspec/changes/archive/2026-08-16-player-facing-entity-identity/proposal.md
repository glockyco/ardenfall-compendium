## Why

The compendium titles 314 character pages from a debugging identifier or from the words `Unnamed character`, and it publishes none of what those characters actually own. A live probe of Ardenfall Demo `0.0.10.91` on 2026-08-15 measured why, and the cause is one modelling defect rather than a set of display bugs.

**The game has one authored object system, and we split it in two.** `ItemData`, `CharacterData` and every record-embedded character copy extend `ParameterizedObject`, whose values resolve up a `parent` chain. A placed record embeds a _copy_ of a definition, so it is a leaf of that same chain. We model definitions and placements as unrelated families with unrelated extractors, and three consequences follow.

_The leaf's own data is invisible._ 262 of 298 placements set parameters themselves, including **14 merchant item lists, 28 merchant gold values and 23 merchant categories**. An earlier measurement recorded merchant inventory as **0 entries, not configured at rest**, and item obtainability was scoped accordingly. That measurement read definitions. The merchants are on the placements, in the master record table, with no world walk required. 84 placements override factions and 44 override item lists, so published faction membership and drops are wrong for those rows.

_The link between the two is missing._ The copy's own asset name is a Unity clone name, which is why `2026-08-03-extraction-coverage.md` concluded a placement "cannot safely link to a character page". Its `parent` is the authored definition in 298 of 298 cases, across 73 definitions.

_Names come from wherever each extractor looked._ `npcs.friendly_name` is `customFriendlyID`, which the game uses only in `Debug.LogError`, ImGui debuggers and editor labels. The name a player reads is `CharacterData.CharName`. 153 of 212 definitions and 265 of 320 placements resolve an authored name that we do not publish.

**And what looked nameless was unmodelled.** Of the 59 definitions with no stored name, **57 carry a race with a player-visible name and two name sets**, so the game synthesises a name per instance from authored vocabulary. `Karu Elf` covers 45 of them with 361 and 948 seeds at Markov order 5. An empty name field was never evidence of missing content.

**One export defect surfaced alongside.** 22 of 320 character records were created by the running game, not by its authors, and `CharacterRecord.IsEditorCreated()` says so. The baseline published 314 placements while the table now holds 320, and the difference is runtime spawns that accumulated while the exporter was connected.

## What Changes

- Extract a placed record as a **leaf of the prototype chain**, through the same resolution as a definition, so the placement's own factions, drops, merchant stock, level and graphs appear without per-field override code.
- Store **provenance beside every published value**: set here, inherited from a named ancestor, generated, or absent. Ownership becomes data instead of a property of whichever extractor ran.
- Emit **`instance_of`** from a placement to the definition it derives from, and expose the inverse as the placements of a type.
- Resolve the **reader-facing type** as the nearest ancestor with a player-visible name, falling back to the race. One rule covers every character without branching, because race is the naming vocabulary for all of them: all 116 humanoid definitions and 93 of the 96 creature definitions carry one.
- Read a placement's name from its own copy through the chain, so `Saya Sako` and `The Lone Healer` replace `Grainery Owner` and `Unnamed character`, and keep `customFriendlyID` as an authoring label that never titles anything.
- Publish **race** and **name sets** as entities, including each set's complete seed vocabulary, and explain generated names by mechanism and vocabulary rather than by a synthesised sample.
- Title a runtime-named character by a **descriptive label** such as `Karu Elf`, marked as a description, disambiguated in listings by location.
- **Stop excluding rows for how their names look.** All 1,273 items and all 212 definitions get pages, with templates marked as templates. The baseline's 9 `itemLootReferencesPrototype` diagnostics show loot lists reaching items we currently withhold.
- **Extract only authored content.** Filter records by `IsEditorCreated()`, report the filtered count, and make an export reproducible for a given build and save.
- Separate **availability** from identity. Disabled and debug-only content stays published and marked, worded as the authored flag rather than as unreachability, and the location extractor stops silently dropping `enabled == false`.
- **BREAKING**: `/placed-characters` is removed. Placements move to `/characters`, definitions to `/character-types`.

### Goals

- One chain, modelled once, with a record as a leaf of it.
- Every published value states who set it.
- Every page title is a name or a description the game justifies, never an authoring identifier.
- An export describes the build, not the session that observed it.

### Non-goals

- New world entities. `VolumeRecord` 98, `NPCTeleportPointRecord` 24, `CreatureData` 4 and `Region` 22 stay unmodelled, though 109 placements own a volume and have a home, which is a strong follow-on.
- The cell-scene walk, which is a separate change and turns out to be 27 loadable scenes rather than the 683 the plans assume.
- Runtime state: live inventories, quest progress, and names the game rolls during play.

## Capabilities

### New Capabilities

- `entity-inheritance`: the prototype chain, records as leaves, per-value provenance, `instance_of`, and type resolution.
- `entity-identity`: display name versus authoring label, name provenance, and what publication depends on.
- `authored-content`: the authored-versus-runtime boundary and export reproducibility.
- `character-catalogue`: the two reader-facing character families, their pages, their titles, and their map behaviour.
- `character-race`: race and name sets as entities, and how they explain a generated name.
- `content-availability`: how content the game marks unavailable is extracted, published and marked.

## Impact

- `entities/character/entity.json`, `entities/npc/entity.json`, `entities/portal/entity.json`, new descriptors for race and name sets, and the descriptor schema that gains `naming` and provenance.
- `mod/src/Entities/Character`, `mod/src/Entities/Npc`, `mod/src/Entities/Location`, and the snapshot DTOs that carry display name, authoring label, provenance, and the definition reference.
- `pipeline/src/entities/character`, `pipeline/src/entities/npc`, `pipeline/src/entities/item`, `pipeline/src/relationships/registry.ts`, and the shared prototype and name resolution.
- `site/src/routes/characters`, `site/src/routes/placed-characters`, the quest and location pages, navigation, and sitemap.
- `fixtures/synthetic/snapshot`, which must carry a template definition, a placement with its own name, an inherited-name placement, a runtime-created record, a merchant placement, and a disabled location.
