## Why

The compendium publishes 314 pages titled from designer identifiers and 134 titled `Unnamed character`, while the game holds real names for those same characters. A live probe against Ardenfall Demo `0.0.10.91` on 2026-08-15 measured it:

|                                       |                                         measured live | published today                                                          |
| ------------------------------------- | ----------------------------------------------------: | ------------------------------------------------------------------------ |
| `CharacterData` definitions           |          212, of which **153 carry an authored name** | 212 pages, 59 titled `Unnamed character`                                 |
| `NPCRecord` placements                |     320, of which **265 resolve to an authored name** | 314 pages titled from `customFriendlyID`, 134 titled `Unnamed character` |
| placements linked to their definition | **298 of 298** that carry data, across 73 definitions | no link exists                                                           |

Three defects sit behind those numbers, and each is a modelling defect rather than a display bug.

**A page title is not required to be a name the game shows a player.** `npcs.friendly_name` is `CharacterRecord.customFriendlyID`, which the game uses only in `Debug.LogError`, ImGui debuggers and editor node labels. The game's own `CharacterRecord.GetFriendlyName()` composes `customFriendlyID(CharName)` for those same debug surfaces. The name a player reads is `CharacterData.CharName`, which the extractor never reads for a placement. Portals have the same defect from the other direction: 27 of 33 titles are authoring strings such as `garkai_sheru-tombs_outside_1`. Nothing in the descriptor distinguishes a name the game shows from a label a designer typed, so each entity invented its own answer and two of them chose the designer's.

**One inheritance mechanism has three unrelated treatments.** `ItemData`, `CharacterData` and every record-embedded character copy extend `ParameterizedObject`, and `Parameter.Get()` resolves values through `parent`. Items suppress prototypes with a composed-name rule, characters emit `derives_from` and suppress nothing, and the copy a record embeds is not modelled at all. The third case is the expensive one: `ScriptableObjectWrapper` stores a per-record clone whose own name is `preset_sapper_stage1(Clone)(Clone)`, but whose `parent` is the authored definition in every one of the 298 measured cases. The claim in `docs/plans/2026-08-03-extraction-coverage.md` that an NPC "cannot safely link to a character page" is wrong, and it cost the graph its single largest missing edge.

**Extraction shape decides the information architecture.** `kind: definition` and `kind: instance` are facts about where data comes from. They currently reach the reader as two adjacent navigation entries, `Characters` and `Placed characters`, which describe the extractor rather than the game. A player asks two different questions: _what is this creature_ and _who is this person_. The current split answers neither, because the definitions that describe a kind are mixed with 59 nameless prototypes, and the placements that name a person are titled with debug labels.

## What Changes

- Add an entity identity contract that separates a **display name**, which the game shows a player, from an **authoring label**, which a designer typed. A public page requires a display name. An entity without one keeps its canonical row, its map marker and its relationships, and it is presented by the page that owns it.
- Publish content by default and require behavioural evidence, not an empty name, before withholding a page. 57 of the 59 definitions that look nameless carry a race with name sets, so the game generates their names at runtime; the item prototype exclusion stays because the game's chain matching justifies it.
- Emit `instance_of` edges from a placement to the definition it derives from, resolved through the prototype chain, and expose the inverse as the placements of a type.
- Read a placement's display name from its own embedded character data through the prototype chain, so `Saya Sako` and `The Lone Healer` replace `Grainery Owner` and `Unnamed character`, and record how the game arrived at each name: authored here, inherited from the type, generated from race name sets, or genuinely absent.
- Keep every placement published. A placement is content a player can encounter, so it keeps its page whatever its name resolves to. Whether the name is the placement's own or inherited from its type is stated on the page as provenance, and a placement with no name says so and identifies itself by its type and its location.
- Rename the reader-facing families. `Characters` becomes the people and creatures a player meets by name; `Character types` becomes the catalogue of what they are. Neither label names an extraction mechanism.
- Move dialogue for a quest character without a display name onto the quest page that owns the dialogue graph, so no content depends on a page that the identity contract removes.
- Apply the identity contract to portals, whose titles become derived presentation with stated provenance rather than authoring strings.
- Separate **availability** from identity. Content the game marks unavailable stays extracted and published, and is marked. Extraction MUST NOT drop a row because a game flag says the content is off: `BuiltLookupTableLocationAssetSource` skips `LocationAsset.enabled == false` today, which makes the `Enabled` field it exports unable to be false and would silently delete locations from the map the moment a build disables one.
- Mark availability the same way in every family. Quests already carry `disabled` and `hidden_in_quest_ui` and state them, but as a sentence on the overview and a `Disabled: No` row on 28 detail pages, and no other family states availability at all.
- Publish `character-race` as an entity, because it is the authored vocabulary that names 57 definitions and every character the game names at runtime, and because it is the classification a reader recognises.
- **BREAKING**: `/placed-characters` is removed. Every placement moves to `/characters`, and definitions move to `/character-types`. No page disappears.

### Goals

- Every page title is a name the game shows a player, or the page does not exist.
- One rule classifies a prototype, and one relation connects an instance to its definition.
- A reader can go from an item to the creature that drops it, to the places that creature stands, and back.
- Descriptors state naming and inheritance behaviour; no route file, read model or extractor restates it.

### Non-goals

- New entity families. The same live probe found `VolumeRecord` 98, `NPCTeleportPointRecord` 24, `CreatureData` 4, `CharacterRace` 112 and `Region` 22 unmodelled, and it measured that 109 of 320 placements own a volume and 109 have a home. Home and ownership relations answer "where does this character live", and they become cheap once these contracts exist. They are their own change.
- Runtime state. A placement's random runtime name, its live inventory, and quest progress stay out.
- The 683-cell streamed world walk, and any provenance that needs it.

## Capabilities

### New Capabilities

- `entity-identity`: display name and authoring label, their provenance, and the rule that decides whether an entity has a public page.
- `entity-inheritance`: the prototype chain, prototype classification, and the relation between a placed instance and its definition.
- `character-catalogue`: the two reader-facing character families, their pages, their map behaviour, and where dialogue lives.
- `content-availability`: how content the game marks unavailable is extracted, published and marked, and why the compendium never states that such content is unreachable.
- `character-race`: the race entity, its name sets, and how it explains every generated character name.

## Impact

- `entities/character/entity.json`, `entities/npc/entity.json`, `entities/portal/entity.json`, and the descriptor schema that gains the naming contract.
- `mod/src/Entities/Character`, `mod/src/Entities/Npc`, and the snapshot DTOs that carry a display name, an authoring label and a definition reference.
- `pipeline/src/entities/character`, `pipeline/src/entities/npc`, `pipeline/src/relationships/registry.ts`, and the shared prototype and name resolution the item read model owns today.
- `site/src/routes/characters`, `site/src/routes/placed-characters`, the navigation, the sitemap, and the redirect table for moved routes.
- `fixtures/synthetic/snapshot`, which must carry a nameless prototype, an inherited-name placement, and an own-named placement.
