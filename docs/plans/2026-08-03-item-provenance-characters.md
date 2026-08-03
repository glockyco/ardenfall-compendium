---
title: Item Provenance, Characters
type: spec
status: active
created: 2026-08-03
parent: 2026-08-02-item-obtainability
superseded_by:
archived:
---

# Item Provenance, Characters

The first source from [`2026-08-02-item-obtainability`](2026-08-02-item-obtainability.md). Model characters as an entity and emit the two provenance relationships they carry, so an item page can finally answer where it comes from.

Characters go first because one extraction yields two sources. A character's inventory is both what a living NPC carries and, unchanged, what its corpse holds, and merchant stock is a second list on the same asset. They also give the 348 loot lists a consumer, which is what makes those lists worth modelling at all.

## Scope, set by measurement

Probed live before writing any code, walking every character's item lists with cycle protection:

| | measured |
| --- | ---: |
| characters | 212 |
| characters with a drop source | **156** |
| distinct items reachable as drops | **504** of 1,273 |
| loot lists walked to get there | 166 of 348 |
| characters with merchant stock | **0** |
| merchant additional items | **0** |

**Drops are worth building and merchant stock is not.** 504 items is 40% of the catalogue reachable from one source. Merchant stock is fully implemented in the game code, with lists, restock timers, categories and faction discounts, and **no character in the demo has any configured**. Exactly one character has a merchant category set at all.

So this slice emits `drops` only. Building `sells` against zero rows would be machinery with nothing behind it, which is the failure this project has spent a day removing. It is not a gap in the design, it is content the demo does not ship, and the playtest may. Revisit it when there is data.

In: the authored `CharacterData` asset as a `character` entity with public pages, and the `drops` edge.

Out: `sells`, until a build has merchant data. Out: the 314 placed `NPCRecord` instances and therefore any claim about *where* a character is, which is the map join and belongs with placement work. Out: containers, quests, recipes, and loot lists as their own entity, each a later source against the same contract.

## Three findings the implementation must respect

**`CharacterData.CharName` mutates the asset.** The getter at `CharacterData.cs:165-183` assigns a random name when `Application.isPlaying` and the stored name is empty. Reading it during extraction would produce a name that is not authored, differ between exports, and write to the running game. Read `charName.Get()?.name` and treat empty as absent, exactly as nameless spells and portals are already handled. Never touch `CharName`.

**Loot lists must be flattened, not rolled.** A reader wants every item a character *can* drop, not one sample. `ItemListAsset` holds groups of `BaseWeightedItemData`, each of which is either a leaf `singleItem`, a nested `listAsset`, or a group of the same. Walk it and collect every reachable `ItemData`. Do not call `GetCountedItems`, which rolls. The walk needs cycle protection: nesting has no depth limit in the game and a self-referencing list would recurse until the stack goes.

**Weights are not probabilities.** A group is either pick-all or pick-X, weights vary by level range, and nesting multiplies counts. A per-item probability is derivable but it is a real calculation, not a field. This slice publishes possibility, not likelihood. Say "can drop" and do not imply a rate we have not computed.

## Contract

**Descriptor** `entities/character/entity.json`, kind `definition`, extraction source the built lookup table. Fields: id, name from `charName.Get()?.name` with a diagnostic when absent, and whatever else earns a page. Route `/characters`.

**Mod** emits a `CharacterSnapshot` carrying the flattened set rather than the list structure: `dropRefs` from `itemLists` plus `additionalItems`, a deduplicated list of `SnapshotRef` to `ItemData`. The nesting is our problem, not the pipeline's, and flattening in the mod is where the game types are available.

Note `CountedItemData`'s field is `item`, not `itemData`, and `CountedLeveledItemListAsset` carries `list` and `level` with no count. Both cost a probe to discover.

**Pipeline** resolves each ref to an item and emits:

| edge | predicate | forward title | inverse title |
| --- | --- | --- | --- |
| character to item | `drops` | `Can drop` | `Dropped by` |

It goes in the relationship registry at `pipeline/src/relationships/registry.ts`. That is the whole site integration, since the generic projection and the generic accessor already handle the rest.

**Site** gains a character index and detail page, following the shape spell and status-effect pages already use. Item pages need no change: the inverse sections appear because the registry declares them.

## Acceptance

- 212 character pages, the 156 with a drop source naming what they can drop.
- Roughly 504 item pages carry `Dropped by`, with no site code written for it.
- A nameless character renders a placeholder and a diagnostic, not a blank or an invented name.
- A self-referencing loot list is handled, and there is a test that would hang without cycle protection.
- No probability or drop-rate wording anywhere.
- Measured against a live export: how many of the 1,273 items gain an inbound edge. That number is the point of the slice and it decides whether loot lists need to become an entity of their own.

## Open

**Character pages are sparse and that is accepted.** A page shows a name and a drop list, because factions, perks, traits and dialogue are not modelled. The alternative was emitting edges without public pages, which makes item provenance work while the source it names stays unreachable, and that is worse. Ship them sparse and let the later character work fill them.

**What reaches the other 769 items.** Characters cover 504. The remaining two thirds are presumably in containers, spawners and quest rewards, which means the placed half carries more weight than the ordering assumed. Measure the same way before committing to the next source rather than arguing about it.
