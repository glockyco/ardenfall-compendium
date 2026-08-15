## Context

Every claim below was measured against Ardenfall Demo `0.0.10.91` on 2026-08-15, either by reading the decompiled assembly in `.decompiled/steam-22145060-63c576261184/` or by probing the running game over HotRepl. The published baseline comes from a live export taken the same day, `snapshots/snapshots/0.0.10.91-20260815-0707496801550`.

**How the game names a character.** `CharacterData.charName` is a `CharacterRandomNameParameter`, a `Parameter<CharacterRandomName>` (`Ardenfall/CharacterData.cs:19`). `CharacterData.CharName` returns the stored value, and only when `Application.isPlaying` and the stored value is empty does it assign `new CharacterRandomName(Race)` (`Ardenfall/CharacterData.cs:165-183`). That property is what a player reads: `IDialogOwner.DialogName` (`Ardenfall/CharacterBase.cs:432`), the loot container title (`Ardenfall/DeadBodyContainer.cs:195`), the pickpocket window (`Ardenfall/PickpocketController.cs:33`), and the `[npc]` and `[npc_<id>]` substitutions in dialogue and journals (`Ardenfall/Dialog/Statement.cs:191`, `Ardenfall/Questing/QuestInstance.cs:492`). Reading the private field through `Parameter.Get()` therefore returns the authored name and never triggers generation. 153 of 212 definitions and 265 of 320 placements resolve to a non-empty value that way.

**What a placement stores.** `CharacterRecord.characterData` is a `ScriptableObjectWrapper` (`Ardenfall/RecordSystem/CharacterRecord.cs:12`). The wrapper is a copy, not a reference: it serialises `serializedType`, `serializedName` and every field whose value is not an unset `Parameter`, and rebuilds the object with `ScriptableObject.CreateInstance` (`Ardenfall/Utility/ScriptableObjectWrapper.cs`). The copy's own name is a Unity clone name such as `preset_sapper_stage1(Clone)(Clone)`, which matches no authored asset. Its `parent`, however, is the authored definition: 298 of the 298 placements that carry data have a parent that is one of the 212 lookup-table assets, spread over 73 definitions.

**What `customFriendlyID` is.** `CharacterRecord.GetFriendlyName()` composes `customFriendlyID(CharName)` (`Ardenfall/RecordSystem/CharacterRecord.cs:408-430`), and every caller is a debugger: `Debug.LogError` in `NonPlayerCharacter`, `ObjectInteractionPackage` and `WanderPackage`, ImGui text in `NPCRecordOfflineAI` and `CharacterDebugger`, and editor labels in `CharacterGraphRef` and `QuestCharacterReference`. No player-facing surface reads it. `PortalRecord.friendlyName` and `VolumeRecord.friendlyName` are the same kind of field.

**Name ownership across placements.** Of the 298 placements with data, 218 set `charName` on their own copy, 47 inherit it from their prototype, and 33 resolve to nothing. A further 22 records carry no character data at all. The 47 inherited names are shared labels: `Darvaki` appears 8 times, `Arakasha Guard` 6, `Fisherman` 5, `Bone Charmer` 4.

**What depends on placements.** 88 quest character objects all resolve to a record. 78 target a placement with its own name, 3 an inherited name, and 7 a placement with no name. 82 carry a dialogue graph, and 6 of those sit on the 7 unnamed targets.

## Goals / Non-Goals

**Goals:**

- One contract decides what a title may be, and the same contract decides whether a page exists.
- One implementation classifies a prototype for every `ParameterizedObject` family.
- The definition of a placement is data, not an inference in a route file.
- The cutover removes the old routes and read models in the same change.

**Non-Goals:**

- Modelling `VolumeRecord`, `NPCTeleportPointRecord`, `CreatureData`, `CharacterRace` or `Region`.
- Changing how items resolve their composed name. Items keep their behaviour and gain a shared implementation.

## Decisions

### 1. A descriptor declares name provenance, not a column name

Each entity descriptor gains a `naming` block with two resolved values.

```json
"naming": {
  "displayName": { "from": "charName.Get()?.name", "policy": "player-visible" },
  "authoringLabel": { "from": "customFriendlyID", "policy": "designer-identifier" }
}
```

`policy` is the contract, not decoration. `player-visible` asserts that the game shows this string to a player and makes the value eligible to title a page. `designer-identifier` asserts the opposite and makes the value ineligible, whatever it contains. The pipeline reads the policy; no read model may title a page from a `designer-identifier` value.

The alternative was a single `title` field per entity. It was rejected because it cannot express the case this change exists to fix: a row that has both kinds of string, where the useful-looking one is the wrong one.

### 2. One display-name test, shared by items and characters

A resolved `player-visible` candidate becomes a display name only when it passes `isDisplayName`: non-empty after trimming, no `{token}` placeholder, and no `BASE` or `PLACEHOLDER` prefix. This is the rule `docs/plans/2026-08-04-item-character-inheritance.md` established for items, lifted out of the item read model and applied to every family. Items keep their composed-name resolution as the _candidate_; only the test is shared. The rule currently suppresses 84 items rather than the 73 that audit recorded in May: the baseline export holds 1,273 canonical items, 1,189 item pages, and 84 `itemNamePlaceholder` diagnostics.

Applied to characters it classifies the 59 nameless definitions, which are exactly `base_creature`, `base_humanoid`, `mannequin`, the `player_*` race presets and the `preset_*` role presets.

### 3. A definition is never excluded for lacking a stored name

An earlier draft called a definition without a display name a prototype and withheld its page. Measurement killed that rule. Of the 59 definitions with no stored name, 57 carry a race with a player-visible name and two name sets, so `CharacterData.CharName` generates a name for every instance at runtime and a player always reads one. Only `mannequin`, whose race has no name and no name sets, and one definition with no race at all, have no naming mechanism.

The structural evidence is no better. 38 of the 59 are the direct type of 198 placements, 9 only parent other definitions, and 12 are referenced by nothing at rest. That last group is not evidence of anything, because `NPCRandomSpawnerGroup.NPCSelection.characterData` and `WeightedNPCRandomSpawnerGroup.manualCharacterList` hold direct references and live in scene cells this export does not read.

So no character definition is withheld. `derives_from` keeps every target. The only exclusion that survives is the item one, and it survives because the game's own semantics justify it rather than because a string is empty: `EnchantmentData.SupportsItem` matches a prototype through `HasParentInChain` as shorthand for its descendants, and `DebugFillContainer` excludes bases by default.

### 4. `instance_of` carries the placement to its definition

The mod resolves `StoredCharacterData.parent` to a `namedAsset` reference and emits it as `npcs.character_ref_json`. The pipeline projects `instance_of`, forward title `Character type`, inverse title `Placements`. The inverse is what turns a type page into a bestiary entry: `Darvaki` lists its 8 sightings as map deep links.

When the parent fails `isDisplayName`, which is the case for 198 of 298 placements whose prototype is a role preset, the edge is suppressed and the placement records `characterTypeUnpublishable` as a diagnostic. This follows the rule the enchantment whitelist already uses for unpublishable targets.

### 5. What is published is decided by encounterability, not by naming

An earlier draft of this design published a placement only when it set its own `charName`, which would have removed 102 pages. That was wrong, and the reason it was wrong is the distinction it missed.

An **authoring artifact** exists only so that other objects can inherit from it. `base_creature`, `preset_myst-elf_peasant` and `BASE ring` are never instantiated as themselves, and no player meets one. They are not content, and the repository already declines to publish 84 template-named items on exactly this ground.

**World content** is anything a player can encounter. A placement holds a position in the world, so it is encounterable by construction, whatever its name resolves to. Deleting its page because a designer typed the name one level up is the same mistake as hiding a disabled quest: it removes real content instead of describing it.

So the rule is: publish every placement, and publish every definition that is not an authoring prototype. A definition is a prototype when it resolves no display name, which classifies the 59 measured cases and no others.

`Parameter.IsSet` keeps its role, but as provenance rather than as a gate. A page whose name is inherited says so, which is a true and useful statement: the game names this character after its type. Eight pages titled `Darvaki` are disambiguated by their containing location, which 193 of 314 placements have, and by their slug's short id, which the node writer already produces.

### 6. Dialogue stays where its speaker is

Because no placement loses its page, dialogue needs no new home. The 6 unnamed quest characters that carry a dialogue graph keep rendering it on their own page, alongside the quest that owns the graph, exactly as today.

### 7. Availability is a second axis, and it is not identity

Identity asks whether a player-facing name exists. Availability asks whether the game currently presents the content. They are different questions, and only the first one decides whether a page exists.

`QuestManager` skips a quest whose `disabled` is set when it builds instances, saves state, or restores them (`Ardenfall/Questing/QuestManager.cs:94, 119, 142, 171`), so the flag is an authoring switch rather than runtime state. It is not, however, a statement about reachability: `SetQuestVariable` logs `QUEST SYSTEM :: Referencing a disabled quest!` (`Ardenfall/Questing/Nodes/SetQuestVariable.cs:108-121`), which proves that live graphs can and do reference disabled quests. `hideInQuestUI` is narrower still: the quest runs and only the journal and quest log skip it (`Ardenfall/Questing/QuestInstance.cs:287`, `Ardenfall/UI/QuestUI.cs:73`).

So unavailable content is published and marked, and the wording states the flag rather than a conclusion. The current quest pages already publish the flag, which is right, but they state it twice in two shapes: a sentence on the overview and a `Disabled: Yes/No` definition row that reads `No` on 28 of 38 pages. One shared notice replaces both.

The extraction side has the real defect. `BuiltLookupTableLocationAssetSource.cs:48` does `if (!asset.enabled) continue;`, so a disabled location never reaches the snapshot, and the `Enabled` field the same source exports can never be false. Today that filter removes nothing, because all 48 locations are enabled, which is exactly why it has gone unnoticed: the first build that disables a location would silently delete it from the map and from the canonical table. The filter goes, and the flag is published.

A sweep of every extractor in `mod/src/Entities` found this to be the only availability filter. The other skips are null guards, deduplication, or `IsAuthoredAsset`, which tests `hideFlags & DontSave` and correctly excludes runtime objects rather than authored content.

### 8. The graph is unaffected, because nothing encounterable loses a page

The baseline export carries 245 `found_at` edges from 193 placements to 28 locations and 88 `features_character` edges from quests to placements. Every one of those endpoints survives this change, so no edge needs suppression, degraded rendering, or a relocated section.

The only suppression left is the one that already exists for unpublishable targets: an edge that would point at an authoring prototype is not emitted, and the source records a diagnostic. That applies to `instance_of` for the 198 placements whose prototype is a role preset, and to `derives_from` where a parent is a prototype. The baseline holds 210 character `derives_from` edges, so that suppression is measurable in the next export rather than theoretical.

### 9. Route names state the reader's model

`/characters` holds the individuals, `/character-types` holds the definitions. Navigation shows `Characters` and `Character types`. `/placed-characters` and its GUID redirects are removed, and every moved page keeps a redirect from its old canonical slug, because those URLs are in a shipped sitemap.

## Risks / Trade-offs

- **Page count falls by 59, and 265 pages gain a real title.** Only the authoring prototypes go. The sitemap, the redirect table and the Pagefind index change accordingly, and every placement keeps a page at a new path.
- **Titles repeat.** Eight pages will be titled `Darvaki`. That is what the game names them, so the fix is disambiguation by location and short id, not invention. Overview tables must show the location column for that reason.
- **Around 55 placements still have no name.** They are published, they state that the game gives them no name, and they are identified by type and location. That is thinner than a named page, and it is honest. The alternative, titling them from `customFriendlyID`, is the defect this change removes.
- **Redirects grow.** All 314 shipped `/placed-characters/<slug>` URLs move to `/characters/<slug>`, and the 59 prototype definition URLs need a target; each redirects to the nearest published ancestor in its prototype chain, or to `/character-types` when it has none.
- **The item path is touched for a shared predicate.** The item composed-name rule is behaviour-preserving here, and the fixture and item tests must prove the 84 suppressed prototypes stay suppressed.
