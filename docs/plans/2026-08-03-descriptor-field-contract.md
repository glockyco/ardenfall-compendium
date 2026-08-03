---
title: Descriptor Field Contract
type: spec
status: draft
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Descriptor Field Contract

Make the descriptor the complete, enforced contract for what an entity emits. It is currently authoritative for some fields and silent about others, and nothing detects the difference.

## The invariant, and where it does not hold

Every guide in this repo says the same thing: `entities/<id>/entity.json` is the only cross-subsystem source of truth for entity shape. The DDL is generated from it, site metadata is generated from it, and `validateDescriptorCoverage` fails a build when a descriptor declares a route with no emitter.

It checks that an entity has a **module**. Nothing checks that an entity emits the **fields it declares**, or only those.

Measured against the 2026-08-03 export, comparing declared fields to fields actually present in snapshot rows:

| entity | declared | emitted | emitted but undeclared |
| --- | ---: | ---: | --- |
| item (with variants) | 91 | 92 | `hardAttackDamMult` |
| location | 9 | 14 | `mapPosition`, `volumes`, `mapRef`, `iconRef`, `fastTravelPosition` |
| portal | 5 | 7 | `position`, `recordRef` |
| character, spell, stat-type, status-effect, item-tag, item-category | — | — | none |

No declared field is ever missing, which is the good half. Eight fields cross from C# into the pipeline without any descriptor mentioning them.

## Why that is worse than untidy

**Seven of the eight are load-bearing.** `location/canonicaliser.ts:51` reads `fields.mapPosition` by raw string key to build map points, and `fields.volumes` to build location volumes. Those two feed 67 map points and 61 volumes, which is the entire map. `portal/canonicaliser.ts` does the same with `position` and `recordRef`.

So the real contract for those fields is a string literal in a C# file and a matching string literal in a TypeScript file, with nothing between them. Rename `mapPosition` in the mod and the canonicaliser reads `undefined`. The build does not fail, the schema does not complain, and the map either empties or collapses to the origin. That is the same failure class as the stat types that shipped zero rows for months, and it is currently unguarded on every entity.

**The eighth is a leak.** `hardAttackDamMult` is used inside the mod at `ItemPresentationBuilder.cs:73` to compute a presentation value, then shipped in every melee row where nothing reads it. It is an internal working value published as data.

## Design

**Declare every emitted field, and say what happens to it.** Some declared fields become a column in the canonical table. Others exist only to be projected somewhere else by a canonicaliser, such as `mapPosition` becoming a row in `map_points`. Both belong in the contract, but only the first should generate a column, so a field needs a storage kind:

- `column`, the default and current behaviour, generates a column in the canonical table.
- `projected`, declared and validated, generates no column, and the descriptor names where it goes so a reader can follow it.

This is the piece that makes the whole thing honest. Without it, declaring `volumes` would create a useless TEXT column beside the `location_volumes` table that actually holds the data, and the fix would be worse than the problem.

**Enforce the set at load.** After a snapshot is loaded and before anything consumes it, assert that every field on every row is declared by the entity or one of its variants. An undeclared field fails the build, naming the entity, the field, and a sample row. This is the guard that would have caught all eight.

**Read through the contract, not by string key.** A canonicaliser should reach a field through something derived from the descriptor, so a rename in the mod becomes a TypeScript error rather than an `undefined`. This is the part that turns a runtime guard into a compile-time one, and it is worth more than the guard.

**Stop shipping `hardAttackDamMult`.** The mod should keep computing with it and not emit it. That is a one-line change once the guard exists to prove nothing downstream cares.

## Acceptance

- Every field in every snapshot row is declared. The load stage fails on an undeclared one with entity, field, and row.
- `mapPosition`, `volumes`, `mapRef`, `iconRef`, `fastTravelPosition`, `position` and `recordRef` are declared as `projected`, with no new columns and no change to `map_points`, `location_volumes` or any rendered page.
- Renaming a field in the mod without updating the descriptor fails the build. There is a test that proves it.
- Canonicalisers no longer index snapshot fields by bare string literal.
- `hardAttackDamMult` is gone from the snapshot and melee presentation is unchanged.
- A live export produces byte-identical diagnostics and the same 1,794 pages.

## Why this before the remaining survey items

Two mod-side findings are still open, splitting asset-source contracts from their Unity implementations and removing the silent Unity catch fallbacks. Both are real and neither is load-bearing. This one guards the contract that every entity depends on, and every future entity widens the exposure, so it gets cheaper to do now than later.
