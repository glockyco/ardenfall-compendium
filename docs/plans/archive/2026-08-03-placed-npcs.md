---
title: Placed NPCs
type: spec
status: implemented
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived: 2026-08-03
---

# Placed NPCs

Put characters in the world, so a location can say who is there.

## The problem

Nothing links to a location. 25 of the 48 location pages have no inbound link at all, and a location page never says who stands there. The compendium models what a character *is* and never who is present anywhere.

The game holds the answer in `NPCRecord`, and none of it is extracted.

## What the game holds

Measured against Ardenfall Demo `0.0.10.91` through HotRepl with the world loaded, not inferred.

| | count |
| --- | ---: |
| `NPCRecord` instances | 314 |
| with a spawn point on a map | 314 |
| carrying an authored name in `customFriendlyID` | 186 |
| inside at least one location | 193 |
| location references in total | 245 |

`NPCRecord` extends `CharacterRecord`, and `NPCRecord.SpawnPoint` is a `WorldPosition` carrying a `Vector3` and a `MapData`. Both maps appear, `overworld` and `interior`.

**This needs no new mechanism.** `ArdenfallGame.instance.worldData.masterRecordTable.GetRecords<NPCRecord>()` is the same source portals already use, and point placement is what the placement foundation slice generalised.

## An NPC does not reference a character

The first design of this slice assumed `CharacterRecord.StoredCharacterData` pointed at an authored `CharacterData`, so an NPC would link to a character page. A live export disproved it, and the numbers are worth keeping because the shape of the mistake will recur.

`CharacterRecord` holds a `ScriptableObjectWrapper`, and that wrapper serialises the whole character inline, field by field. Each record carries its own private copy, so there is no asset to point at. `ScriptableObjectWrapper.Deserialize` calls `CreateInstance(serializedType)` and then assigns `name = serializedName`, which means the object's name is a serialisation artefact rather than an identity.

The export proved it. All 292 references we emitted read names like `preset_sapper_stage1(Clone)(Clone)(Clone)`. **None matched an authored character**, and only 234 matched after removing the `(Clone)` suffixes, so stripping them would have invented an identifier for 58 records and still guessed for the rest.

`CharacterData` carries no id, and of 298 records with embedded data, **none carries a stored name**. The game invents a random name from the race at play time, so the field is empty at rest. A reader-facing character name simply is not in this data.

What is authored is `NPCRecord.customFriendlyID`, and 186 of the records carry one: `Grainery Owner`, `Fishermen`, `Grain Thief`, `Potion Seller`, `Sick Girl`. That is a name a reader can use, so it is the one the compendium publishes.

An NPC therefore has a name and a place, and no character link. It stays page-less, exactly as a portal does, and it appears as a map marker and in a list on the location pages that contain it.

## Containment is game logic, so the mod decides it

`LocationAsset.IsInside(position, map)` is the game's own test, and it accounts for a location's several volumes. The pipeline holds only coordinates and axis-aligned bounds, so it can approximate that and would get a worse answer.

The mod therefore runs the game's test and emits the resulting location ids as a fact. Distribution across the 314:

| containing locations | NPCs |
| ---: | ---: |
| 0 | 121 |
| 1 | 146 |
| 2 | 42 |
| 3 | 5 |

**Several locations is not ambiguity.** `MapLocationManager` marks the player as entered in *every* location whose volume contains them, at the same time, so nesting is the game's model. A character inside both `Akaga` and `Akaga Workshop` is in both.

121 NPCs sit inside no location, which is honest. They stand in open world outside any named place.

## What this is worth

| | count |
| --- | ---: |
| NPC-to-location references | 245 |
| locations gaining a section | 41 |
| locations gaining a section | 25 |
| new map markers | 314 |

25 of the 48 locations have no inbound link today, so this is the first thing that points at them.

## What changes

### A new instance entity with no page

`npc` follows portals exactly: `kind: instance`, `extraction.source: record`, root `masterRecordTable.GetRecords<NPCRecord>`, placement `point` from `SpawnPoint`.

**It gets no page.** An NPC carries a name and a position and nothing else a reader could read for a page. `has_page` is 0, its route is the map query, and its identity carries the record id. This is the portal decision and the same reasoning.

An NPC with no `customFriendlyID` produces a diagnostic and a null name. 134 of the 320 records are in that state, so a reader meets this case often and it must never show an identifier instead.

### One derived predicate, honestly labelled

`found_at`, NPC to location. `forwardTitle: "Found at"`, `inverseTitle: "Characters found here"`.

The edge is derived rather than field-shaped, so its evidence must say so: it comes from an NPC spawn point tested against location volumes with the game's own containment function, and it names the NPC record it came from. An audit already caught `applies` claiming one false source for every edge, and a derived edge that hides its derivation is the same defect.

The edge runs from the **NPC** to the **location**. An NPC has no page, so the edge renders only on the location, which is the side that gains the reader-facing fact. The first design ran it from a character, and that dropped every edge once the character reference proved not to exist.

### The map gains an NPC layer

314 points, labelled with the NPC's authored name where it has one. The layer follows the descriptor-owned map contract every placed entity already uses.

## Rejected

**Giving each NPC a page.** 314 pages carrying a name and a coordinate and nothing else. The portal decision applies: an instance with nothing to read gets identity and placement, not a page.

**Deriving containment in the pipeline.** It would mean reimplementing `LocationAsset.IsInside` against stored bounds. The game's function is authoritative and available at extraction time, so using anything else would be inventing a second answer to a question the game already answers.

**Attributing portals to locations the same way.** Re-measured with the game's own test rather than the axis-aligned approximation used before: 23 of 33 portals sit inside no location. A doorway sits on a boundary, so this confirms the earlier decision rather than overturning it.

## Acceptance

- A location page lists the characters found there, and a character page lists where it is found.
- 25 locations and 64 characters gain a section, from 106 pairs.
- The map shows 314 NPC markers, and an NPC has no page.
- An NPC with no character reference produces a diagnostic.
- Each `found_at` edge's evidence names the NPC record and states that containment came from the game's own test.
- Verified on a live export with the counts above reproduced.
