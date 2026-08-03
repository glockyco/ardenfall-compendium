---
title: Spell Effects
type: spec
status: implemented
created: 2026-08-03
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived: 2026-08-03
---

# Spell Effects

Make a spell page say what the spell does.

## The problem

A spell page names its governing skill and its mana cost, then prints a prose tooltip. It states no mechanics, because seven fields reach the `spells` table and none of them is the effect graph.

`SpellData` holds the mechanics in three places our extractor ignores: `spells`, a `List<SpellEffect>`, `subSpells`, and `spellEffectReference`. The roadmap's spell slice promised this and it was never built, which the roadmap now says.

## What the game holds

Measured against Ardenfall Demo `0.0.10.91` through HotRepl, not inferred.

| | count |
| --- | ---: |
| spells | 56 |
| effect objects in `spells` | 81 |
| distinct effect classes | 17 |
| sub-spells | 5 |

By class: `SelfStatusEffectSpellEffect` 20, `SoundsSpellEffect` 18, `ProjectileSpellEffect` 8, `TargetStatusEffectSpellEffect` 7, `RangedAttackSpellEffect` 6, `SpawnPrefabSpellEffect` 5, `AOESpellEffect` 4, `TargetAIValueSpellEffect` 4, and ten classes with one each: `ProjectilePrefabSpellEffect`, `RaiseDeadAOESpellEffect`, `RaiseDeadSpellEffect`, `FlingSpellEffect`, `SubTooltipSpellEffect`, `SummonDecoySpellEffect`, `IncreaseCompanionTimeSpellEffect`, `SummonCharacterSpellEffect`, `TrapSpellEffect`.

A status effect reaches a spell through `LeveledLeveledStatusEffect`, which carries the effect plus a `LeveledFloat` level and lifetime, or through a bare `StatusEffectData` field. `TargetStatusEffectSpellEffect` holds a **list** of them rather than one, so an effect can apply several and a walker that reads single fields only will undercount.

## What this is worth, honestly

**The value is the spell pages.** 56 pages currently cannot say what their spell does.

The connectivity prize is modest. 27 references reach 25 distinct status effects, and **13 pages gain a first inbound link**, taking status effects with no inbound link from 116 to 103.

Two earlier estimates were wrong and are worth recording. The first claimed 116, which counted every unlinked status effect rather than the ones spells reach. The second claimed 40 references over 33 effects, from a probe that recursed into every collection on every effect object and so counted status effects held by unrelated structures. A targeted walk produces 27, and only the walk is authoritative.

## What changes

### The mod emits an explicit DTO per effect, never reflected JSON

No raw Unity or Odin JSON reaches a snapshot. Each effect emits a record naming its kind and only the fields we can read and name.

Three groups, decided by what a reader gains:

- **Status effect application**: `SelfStatusEffectSpellEffect` 20 and `TargetStatusEffectSpellEffect` 7, carrying 27 references between them. Emit each reference with its level and lifetime, and whether it lands on the caster or a target. The self class holds one reference and the target class holds a list, so the walker handles both, and in this build every list holds exactly one. This is the group that produces edges.
- **Direct mechanics**: `ProjectileSpellEffect`, `AOESpellEffect`, `RangedAttackSpellEffect`, `FlingSpellEffect`, `TrapSpellEffect`, `SpawnPrefabSpellEffect`, `ProjectilePrefabSpellEffect`, the two `RaiseDead` classes, `SummonCharacterSpellEffect`, `SummonDecoySpellEffect`, `IncreaseCompanionTimeSpellEffect`. Emit the kind plus the fields each class genuinely carries, read from the decompiled source rather than guessed.
- **Not reader-facing**: `SoundsSpellEffect` 18, `SubTooltipSpellEffect` 1, `TargetAIValueSpellEffect` 4. These describe audio, tooltip plumbing and AI weighting. Record the decision to skip them rather than emitting a kind with nothing in it.

An effect class the mod does not recognise is a diagnostic, not a silent skip. A new class in a future game build must surface.

### The pipeline canonicalises effects into rows and one new predicate

`spell_effects` holds one row per emitted effect, keyed by spell and ordinal, because the game's list order is the only stable discriminator.

One predicate, `applies`, already exists and already means an item applies a status effect. A spell applying one is the same relation from a different source, so it reuses that predicate with its own evidence naming `spells.spellEffects`. The audit that split `applies` provenance is why the evidence must say which field carried the fact.

### The site renders effects on a spell page

A spell page gains an effects section listing what the spell does, with a link to each status effect. It reuses the item page's effect list shape where the data allows, rather than inventing a second presentation for the same idea.

## Rejected

**Typed columns per effect class.** 17 classes with different field sets would mean 17 tables or a wide sparse one, to describe 81 rows. The row count does not justify it and the schema would change with every new class the game adds.

**Reflecting over effect fields and storing the result.** It would cover all 17 classes for almost no work, and it is exactly the raw-graph dump the project forbids. A field nobody named is a field nobody can be held to.

## Acceptance

- A spell page states its effects, and a spell that applies a status effect links to it.
- 13 status-effect pages gain a first inbound link, and `applies` grows by 26 spell-sourced edges.
- An unrecognised effect class produces a diagnostic naming the spell and the class.
- No snapshot field holds reflected or untyped game data.
- The three skipped classes are named in the descriptor or its comments, so the omission is a decision and not an oversight.
- Verified on a live export, with the effect counts above reproduced.
