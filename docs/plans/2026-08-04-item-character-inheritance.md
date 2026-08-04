---
title: Item and Character Inheritance Audit, 2026-08-04
type: audit
status: active
created: 2026-08-04
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Item and Character Inheritance Audit, 2026-08-04

This audit records Ardenfall's prototype inheritance, its measured impact on the compendium, and the decisions that make inherited data and relationships reader-safe.

## The mechanism

`ItemData` and `CharacterData` both extend `ParameterizedObject` (`Ardenfall/Item/ItemData.cs:9`, `Ardenfall/CharacterData.cs:16`). `ParameterizedObject.parent` is the prototype reference (`Ardenfall/ParameterizedObject.cs:11-16`). This is inheritance, not merely an asset grouping.

`Parameter<T>.Get()` returns the parameter's own value when `isSet`. Otherwise it reads the same parameter from `owner.parent`, continuing through the chain (`Ardenfall/Parameter.cs:142-166`). The extractor already reads through `.Get()` everywhere, so inherited field values are correct in the snapshot. It did not previously export the parent relation or the reader-facing consequences of that relation.

`HasParentInChain` walks the chain recursively with a cycle guard and a cache (`Ardenfall/ParameterizedObject.cs:69-101`). Twenty-six game call sites use chain matching rather than identity. They include `EnchantmentData.SupportsItem` (`Ardenfall/Item/EnchantmentData.cs:116-129`), `ItemFilter`, `CharacterFilter`, `Questing/Nodes/ItemFilter`, inventory matching, and equipped-slot matching. A chain match means "this is or derives from that object" in those systems.

## Measured shape

Every number below came from a live probe on 2026-08-04, cross-checked against release `0.0.10.91-20260804-0623314535360`.

| | assets | have a parent | are a parent | deepest chain |
| --- | ---: | ---: | ---: | ---: |
| `ItemData` | 1,273 | 1,238 | 173 | 4 |
| `CharacterData` | 212 | 210 | 60 | — |

The relation is common. It is not safe to treat it as an implementation detail or to infer a public prototype class from structure alone.

## The prototype trap

Being a parent does not make an item a prototype. Of the 173 parent items, **109 are also real obtainable items**, including `Dark Steel Katana` and `Chopsticks`. A structural rule would have deleted those pages.

The rule that matches the game is reader-facing. Resolve the display name through the inheritance chain, then apply the mod's name-composition step. An item is unpublishable when that composed name starts with `BASE` or `PLACEHOLDER`, case-insensitively, or contains a `{token}`. This identifies **73 items**: 64 with descendants and 9 leaves, including `PLACEHOLDER`, `BASE ring`, `BASE lantern`, and `Scroll of {lvl} {name}`. Only 7 occur in any loot list.

The raw game name field is a second trap. It is a template on **486 items**, but the mod composes real names for potions, scrolls, and slates from their spell or effect. Judging the raw parameter would unpublish **486 pages**, including **380 obtainable items**. Prototype classification therefore uses the composed reader-facing name, never the raw parameter.

## Decisions

### 1. Prototypes have no public item page

The 73 items that fail the composed-name rule have no public page. The extractor emits a diagnostic naming each item and omits it from the item read model. This follows the existing precedent for debug-only locations and internal-named portals. A structural parent test is explicitly not part of this rule.

### 2. Chain-matched enchantment relationships resolve to descendants

`EnchantmentData.baseItemDataFilterWhitelist` uses `HasParentInChain` to name a prototype as shorthand for every descendant (`Ardenfall/Item/EnchantmentData.cs:116-129`). Publishing the whitelist literally produced **139** links reading `Can enchant → Base`.

When a whitelist target is unpublishable, `enchants` emits one edge for every transitively reachable publishable descendant and never emits an edge to the prototype. The current whitelist has **19 distinct targets**, **18** of them prototypes, and chain resolution produces **484 publishable descendants**. No fan-out cap is applied. The deepest measured chain is four.

### 3. Loot references to prototypes are diagnostics, not fan-out

A chain-matched filter means that descendants qualify. A loot entry is the item the game puts in the list. The **8** `can_drop` edges to unpublishable items therefore do not fan out to descendants. The game's `DebugFillContainer` excludes bases by default through `addBases` (`Ardenfall/Utility/DebugFillContainer.cs:16-26`). Emit `itemLootReferencesPrototype` for each such reference and omit the edge instead of inventing drops.

### 4. The parent relation is public data

Items and characters gain `parentRef`, a `SnapshotRef` to the parent asset, with `missing` when no parent exists. The canonical columns are `items.parent_ref_json` and `characters.parent_ref_json`.

The predicate is `derives_from`: the descendant is the source and the parent is the target. Its forward title is `Derives from` and its inverse title is `Variants of this`. Suppress the section when the parent is unpublishable. A reader can see what `Azure Mage Robes` derives from, while a real parent such as `Dark Steel Katana` can list its descendants without being misclassified as a prototype.

### 5. Character pages remain an open maintainer question

`CharacterData.CharName` has no authored value (`Ardenfall/CharacterData.cs:165-183`). While the game plays, it assigns `new CharacterRandomName(Race)`. All **212** character definitions are therefore nameless by design, every current page is titled `Unnamed character`, and all **212** have no inbound link. **Sixty** are prototypes.

The extraction and `derives_from` relation are still modelled. Whether character definitions should have public pages is not decided here. The evidence supports at least two maintainer options: keep the 212 pages as explicit `Unnamed character` definitions so their authored data and inheritance remain inspectable, or suppress character pages and retain only the internal extracted relation until a stable reader-facing identity or useful inbound connectivity exists. A decision must consider that removing the entity type would remove all 212 pages, not just the 60 prototypes.

## Related presentation decisions

The inheritance work also closes four duplicated relationship sections. The graph owns character `Drops` through `can_drop` and enchantment `Can enchant` through `enchants`, because the graph disambiguates and supplies the shared inverse. The potion-recipe panel owns `Produces` and `Ingredients`, because it carries drinkable or throwing detail and ingredient counts. Where the panel owns the forward presentation, the predicate keeps its inverse title and sets `forwardTitle: null`, as `speaks_about_quest` does.

An item's name has one owner. The item read model resolves the composed name into `entity_nodes.label` and carries `name_is_placeholder` in `item_presentation_rows`. The site no longer owns a competing placeholder rule in `site/src/lib/components/items/itemName.ts`. This keeps links, headers, and relationship sections on the same reader-facing name and makes the explanation data-driven.

## Consequence for coverage

Item inheritance is now an extraction concern as well as a game mechanism. It adds the parent reference and the diagnostics and descendant resolution described above. It does not enumerate world-owned item provenance. The **683-cell** streamed world walk remains the work required to reach the 278 items behind 182 scene-owned item lists, unchanged by this audit.
