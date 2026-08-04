---
title: Game Field Assumptions Audit, 2026-08-03
type: audit
status: active
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Game Field Assumptions Audit, 2026-08-03

Where our behaviour rests on a guess about what a game field means.

## The defect class

`showOnMap` controls whether the player's in-game map draws a marker. We read the name, assumed it meant "this place is on the map", and used it to decide whether a location deserved a page. That withheld 14 real, named, enabled locations.

The general shape: **a field's name and its use can disagree, and only the game source settles it.** A name suggests a meaning, our code acts on the suggestion, and nothing checks the suggestion against the game.

Five audits ran over gate flags, publicity rules, numeric units, display names and relationship predicates. Every finding below carries a game citation, a citation in our code, and a measured row count. A claim with no measured cost is marked as latent.

## What was already fixed

**`showOnMap` used as a page gate.** `Ardenfall/LocationAsset.cs:25` puts the field under a literal `[Header("In-game Map")]`. `Ardenfall/UI/PlayerWorldMapUI.cs:85` reads it to draw a marker and combines it with whether the player found the place. `Ardenfall/MapLocationManager.cs:58` filters live content with `where loc.enabled`. All 48 locations are enabled, so the marker flag alone withheld 14. See [`2026-08-03-location-pages`](archive/2026-08-03-location-pages.md).

## Findings

### Portal names are authoring identifiers

`entities/portal/entity.json:20` reads the game's `friendlyName`. `Ardenfall/RecordSystem/PortalRecord.cs:7` declares it and returns it directly, and no player-facing UI reads it. 29 of 32 named portals hold values such as `garkai_sheru-tombs_outside_1`, `sc_tutcave_ext` and `akaga.lighthouse.entrance`. Only `Underground Preservium`, `Ladder Door` and `Food Preserve` read as prose.

The extractor is correct. The game simply authored identifiers into a field whose name promises otherwise. Portals therefore get no page, which the location work applied.

### Portal accessibility has no game consumer

`Ardenfall/RecordSystem/PortalRecord.cs:12` declares `isAccessable` with a default of `true`. `PortalRecord.Copy()` at line 45 is its only reader. The method copies the value into a new record, and no game code uses it to decide whether a portal works or blocks passage.

The live portal data measured 33 of 33 rows as `true`. The field carries no variation in the current game data, and its use does not define player access. We therefore deliberately do not extract `isAccessable` or rename it to `isAccessible` in the compendium.

### A cooldown is a duration shown without its unit

`mod/src/Entities/Item/ItemPresentationBuilder.cs:14-18` builds a row labelled `Cooldown` and supplies no suffix, so `site/src/lib/components/items/ItemStatRow.svelte:13` renders a bare number. `Ardenfall/Item/ConsumableItem.cs:44-47` returns the value as a quick-use duration, and `Ardenfall/StatusEffectTooltip.cs:31-34` shows the game appending `Seconds` to a comparable value. 46 rows of `item_consumables` carry one.

### An `applies` edge claims a source it does not have

The release carries 266 item-sourced `applies` edges and 26 spell-sourced edges, 292 in total. The item edges collect effects from three places, and the game applies them by three mechanisms: on use for a consumable (`Ardenfall/Item/ConsumableItem.cs:110-118`), on hit for a weapon (`Ardenfall/Item/MeleeItem.cs:425-427`, `BowItem.cs:406-408`, `ThrowingItem.cs:290-292`), and on a target for a thrown potion (`Ardenfall/Item/ThrowingPotion.cs:271-275`).

The release evidence names the source field for each item fact. One evidence string covering three mechanisms would be worse than a vague one, because it would read as precise and be wrong.

### An item name can fall back to an internal row id

`mod/src/Entities/Item/ItemPresentationBuilder.cs:25` sets `displayName = fields.name ?? rowId`. Every other entity answers a missing name with a diagnostic and a null, a policy this project adopted after asset-name fallbacks put `itemcat_weapons` in front of readers. No item is nameless in this release, so the fallback is latent, which is why it survived the earlier cleanup.

### A reader sees raw format strings and internal disambiguators

`site/src/lib/components/items/itemName.ts` recognises a game format string such as `Recipe of {0}` or `Potion of {lvl} {name}` and returns `Name unavailable`. Only four files used it, so a listing outside the item routes showed the raw string. 23 item names in the release hold a brace template. A page still carries one inside its hydration payload, which is correct, because the raw value is data and the helper sanitises it for display.

`site/src/lib/components/items/ItemOverviewFilters.svelte:57-64` disambiguates a repeated name with `row.variant ?? row.id`. That is a raw variant id, so a reader sees `Ancient Tsukasa Viewing Lenses — armor`, and it is not unique: 29 links all read `Name unavailable — armor` while pointing at 29 different pages, which fails WCAG 2.4.4.

Duplicate labels across the snapshot: 84 groups covering 260 item rows measured on the raw name, or 78 groups covering 273 links as the page actually rendered them, plus 9 groups covering 19 status effects, 2 groups covering 4 spells and 1 group covering 2 locations. Characters and relationship sections already disambiguate with `<label> · <shortId>`.

### Latent: `scales_with` hardcodes the word skill

`pipeline/src/entities/spell/read-models.ts:156` emits `"Scales with skill"`. `Ardenfall/StatType.cs:24-31` reads `isAttribute` to choose between a character's attributes and skills. All 56 current edges target a stat with `is_attribute = 0`, so the label is right today and wrong as soon as a spell scales off an attribute.

## What the fixes measured

Verified against a live export rather than the fixture.

| defect | before | after |
| --- | ---: | ---: |
| Cooldown rows with no unit | 252 | 0 |
| `applies` edges | 266 item-sourced | 292 total: 266 item-sourced and 26 spell-sourced |
| Duplicate link text on `/items` | 273 links | 0 |
| Duplicate link text on `/status-effects` and `/spells` | 23 rows | 0 |
| Reader-visible brace templates | present | 0 |

The cooldown suffix agrees with the number beside it, so 12 rows read `1 Second` and 239 read `2 Seconds`. `applies` evidence now names the field each fact came from: 195 area of effect, 21 weapon bleed, 50 on use. `scales_with` reads the stat kind, and all 56 current edges still say skill because every target is one.

One fix produced a defect that only a rendered page showed. Sanitising the name also sanitised the line below it, so 90 pages read `Source value: Name unavailable`, which repeated the heading and told a reader nothing. That line now gives the reason instead.

## Checked and correct

Recorded so nobody audits them twice.

**Gate flags.** `enabled` matches `Ardenfall/MapLocationManager.cs:58`. `showOnMapDebugOnly` is presentation and the site map filters on it as presentation. `showInAllCategory` matches `Ardenfall/Inventory.cs:672-676` and gates nothing of ours. `isAttribute` groups stats exactly as `Ardenfall/StatType.cs:24-31` does. `isHostile` is carried and never gates.

**Declared and unconsumed**, so they cannot mislead a reader yet: `hideInGui`, `isValid`, `cannotBeOwned`, `questItem`, `lockedByDefault`, `enableSkillRequirement`, `stackable`, `twoHanded`, `canBlock`, `pierceArmor`, and the spawn-visual flags. `item.isIllegal` is stored on 8 rows and has no reader-facing use, while `spell.isIllegal` is displayed and correct.

**Publicity.** Seven entities publish every extracted row, which matches the game's built asset lookup at `Ardenfall/BuiltLookupTable.cs:83-95`. No invented gate exists outside locations.

**Coordinates.** `Ardenfall/LocationAsset.cs:13-15` declares volumes as Unity `Vector3` and tests with `Bounds.Contains`. Our canonicaliser maps `{x, -z}` to map axes and `y` to elevation, and the map renderer consumes those directly. The values carry no physical unit in the game either, so a location page states that rather than inventing one.

**Numbers.** `minimumSkill` is `Parameter<int>` at `Ardenfall/Item/EquipItemData.cs:23-25` and INTEGER end to end, so the earlier lexical-sort defect is absent. Item weight and value are raw game values with no unit defined anywhere in the game. Durability is stored normalised and the site shows only the maximum, so the game's percentage display is not contradicted. Status-effect numbers are tooltip examples and the page says so.

**Predicates.** `categorised_as` matches `Ardenfall/Inventory.cs:667-677`. `casts` matches `Ardenfall/SlateSpellItem.cs:55-61`. `tagged` matches `Ardenfall/Item/ItemData.cs:35-38`. `leads_to` matches `Ardenfall/RecordSystem/PortalRecord.cs:8-30`, and its reciprocal pair is genuinely two directed edges because `Ardenfall/MapLocationManager.cs:72-113` maps both directions.

## Names that misled, and were renamed

A name that needs a paragraph of explanation is a defect, not a documentation gap. Each of these was renamed rather than described.

**`is_public` became `has_page`.** It never meant public. The proof it misled is that two consumers wanting a stable identity had to be told not to test it, and a fail-fast check had to be split because one flag answered two questions.

**The `drops` predicate became `can_drop`.** `Ardenfall/Item/ItemGroup.cs:35-67` picks all items in a group or a weighted random count, so presence is possible and not certain. The rendered titles already read `Can drop` and `Dropped by`, so only the predicate overstated. 2,126 edges. A per-item probability is still a real calculation across pick groups and level-ranged weights that we do not perform, so no rate is published.

**`portals.name` became `friendly_name`.** A column named `name` promises a display name, and 29 of 32 values are authoring identifiers. The new name states its provenance and promises nothing.

**`item_variants.is_public_route` became `has_page`**, so one word covers one concept across the schema.

**`site_entities.canonical_table` was deleted.** It was fabricated as the entity id plus `s`, which named no table: `item-categorys`, `stat-types`, `status-effects` against real tables `item_categories`, `stat_types` and `status_effects`. Nothing read it, and the descriptor already declares the real value, so a correct column would have duplicated the source of truth.

### A field named for graphs holds the wrong kind of graph

`Ardenfall/CharacterData.cs` declares `characterGraphs`, a list of `CharacterGraphContainer`. The name and the container type both read as though a character owns the dialogue they speak, and a first implementation of the dialogue slice took exactly that reading.

The reading is wrong. A live probe measured 196 containers across 113 characters, of which **195 hold a plain `ObjectFlowGraph`** and exactly **one** holds a `DialogFlowGraph`. The field holds character behaviour. Extracting from it produced a single greeting for the whole game.

Authored dialogue hangs off `CharacterQuestObject.dialogGraph.flowGraph`, where 82 of 88 quest character objects carry a real `DialogFlowGraph`. That is what the shipped slice reads, and the same probe shape now yields 484 lines.

The cost was a full slice built and reverted. What would have prevented it is cheap: count the concrete runtime types behind a field before believing its declared type.

### Two node kinds expose the same text through different accessors

`GreetingFlowNode` and `TopicFlowNode` both hold a private `statement` field, and a walk naturally treats them as one shape. They are not.

`GreetingFlowNode.EditorGetStatement()` is public and pure. `TopicFlowNode` has no such method. Its only public path is the explicit `ITopicNode.GetTopicStatements()`, which consults live graph state through `IsNodeChoiceEntered` and `ApplyModifiers`, and at line 88 prefixes the result with `[Debug]` or swaps in a failed-check alternative. No asset-time walk can satisfy it, and its output is not the authored text.

The extractor therefore calls the public accessor for greetings and reads the authored `statement` field directly for topics, which is also the text a reader wants: source prose before any runtime rewrite.

An earlier probe missed this and called `EditorGetStatement` on both. Topics silently returned nothing, so the probe reported 292 authored lines when the real figure was 484. A missing method on one branch of a walk reads exactly like an absence of data.

### `Statement.id` and `TopicFlowNode.topicTag` are never authored

Confirmed against the live game and unchanged. `Statement.id` is blank on all 1,131 greeting and topic lines, because `TopicFlowNode` assigns it at runtime from the graph name and node id. `topicTag` is blank on all 488 topics. Neither is extracted.

## Recorded, not defects

**`variant_of` is accurate.** `Ardenfall/Item/ItemData.cs:100-109` returns the concrete runtime class, and a variant is this project's own term for exactly that, defined in `schemas/variant.schema.json` and carried through `item_variants`, `variantId` and the `/items/variant` routes. The game class is recorded explicitly as `unityType`, so the provenance is stated rather than implied. 1,273 edges.
