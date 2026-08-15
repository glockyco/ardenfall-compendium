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

A resolved `player-visible` candidate becomes a display name only when it passes `isDisplayName`: non-empty after trimming, no `{token}` placeholder, and no `BASE` or `PLACEHOLDER` prefix. This is the rule `docs/plans/2026-08-04-item-character-inheritance.md` established for items, lifted out of the item read model and applied to every family. Items keep their composed-name resolution as the _candidate_; only the test is shared.

Applied to characters it classifies the 59 nameless definitions, which are exactly `base_creature`, `base_humanoid`, `mannequin`, the `player_*` race presets and the `preset_*` role presets.

### 3. A prototype is a definition without a display name

`derives_from` stays as it is. Prototype classification stops being an item-specific rule and becomes the same predicate for both families, so a definition that fails `isDisplayName` has no page and is never an edge target.

### 4. `instance_of` carries the placement to its definition

The mod resolves `StoredCharacterData.parent` to a `namedAsset` reference and emits it as `npcs.character_ref_json`. The pipeline projects `instance_of`, forward title `Character type`, inverse title `Placements`. The inverse is what turns a type page into a bestiary entry: `Darvaki` lists its 8 sightings as map deep links.

When the parent fails `isDisplayName`, which is the case for 198 of 298 placements whose prototype is a role preset, the edge is suppressed and the placement records `characterTypeUnpublishable` as a diagnostic. This follows the rule the enchantment whitelist already uses for unpublishable targets.

### 5. A page needs an owned name, and everything else is a marker

A placement gets a page when its own `charName` parameter `IsSet` and the value passes `isDisplayName`. That is 218 placements. The remaining 102 keep their canonical row, their placement, their map marker and their edges, and they appear on the type page and the location page rather than as pages of their own.

The distinction is not a heuristic. `Parameter.IsSet` is the game's own record of whether a designer authored this value here, and an inherited value means the designer said "one of these", not "this one".

The alternative, giving every placement a page and titling the inherited ones with the type name, was rejected because it produces eight pages titled `Darvaki` that differ only by coordinates, which is what a map marker already says better.

### 6. Dialogue follows the page that survives

Dialogue hangs off `CharacterQuestObject.dialogGraph`, so the quest already owns it. Today the placed-character page renders it. For the 6 unnamed quest characters that carry dialogue, the quest page becomes the only renderer; for named ones, both the character page and the quest page keep their existing sections. No dialogue is dropped, and no page is kept alive only to host it.

### 7. Route names state the reader's model

`/characters` holds the individuals, `/character-types` holds the definitions. Navigation shows `Characters` and `Character types`. `/placed-characters` and its GUID redirects are removed, and every moved page keeps a redirect from its old canonical slug, because those URLs are in a shipped sitemap.

## Risks / Trade-offs

- **Page count falls by about 150.** 59 definitions and 102 placements lose pages, and 218 placements gain real titles. The sitemap and Pagefind index shrink accordingly. This is intended: those pages were titled `Unnamed character` and carried no inbound link.
- **`IsSet` is load-bearing.** If a future build authors names on prototypes instead of placements, the individual set shrinks silently. The pipeline emits the own-named, inherited and nameless counts as diagnostics so the split is visible in every export.
- **Redirects grow.** 314 placed-character URLs move or disappear. Removed pages redirect to the type page when one exists, and otherwise to the map deep link for the placement, so no shipped URL dead-ends.
- **The item path is touched for a shared predicate.** The item composed-name rule is behaviour-preserving here, and the fixture and item tests must prove the 73 suppressed prototypes stay suppressed.
