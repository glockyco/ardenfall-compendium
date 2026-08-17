## Context

See `proposal.md` - Why for the measurements. Decompiled paths are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`.

- `Ardenfall/Dialog/Nodes/FactionCheck.cs` holds `List<Faction> factionGroups` and
  `ListCompareMethodUtility.ListCompareMethod compareMethod`. `RaceCheck.cs` holds
  `List<RaceGroup> raceGroups` and the same vocabulary.
- `Ardenfall/Nodes/RelationshipCheck.cs` holds `sourceCharacter` and `targetCharacter` as
  `CharacterGraphRef`, a `CompareMethod`, and a `RelationshipCheckAmountContainer` whose `amount` is a
  `RelationshipRange`. The source defaults to the player and the target to the dialogue character.
- `Ardenfall/Nodes/BranchRelationshipNode.cs` registers five flow outputs: Honored, Accepted, Neutral,
  Disliked, and Despised with the alias Vilified.
- `Ardenfall/Dialog/Nodes/ListCompareMethodUtility.cs` renders a condition as "Is X" or "Is Not X", so
  reader-facing wording follows the game rather than inventing a phrasing.
- `Ardenfall/RaceGroup.cs` is a `ScriptableObject` with `groupID`, `groupName` and an icon.

## Goals / Non-Goals

**Goals:**

- Publish authored conditions with resolved subjects and the game's comparison vocabulary.
- Bind a line to a relationship tier where the flow plane already carries that link.
- Report how many conditions remain unbound, so coverage is a number rather than a belief.

**Non-Goals:**

- No evaluation. Extraction never asks whether a condition passes; that needs a player, a blackboard and
  live relationship values.
- No per-line binding for value-plane conditions in this change. The port model is out of scope, and the
  unbound count makes the remainder visible.
- No composition semantics. Two conditions feeding one consumer are two rows; the export states neither
  an order nor a boolean combination.
- No relationship arithmetic. A tier is published as the game's named range, not as a number.

## Decisions

### Publish the declaration, and let the game supply the words

A condition's authored parts are a kind, subjects and a comparison, and the game already turns that
triple into prose. Reusing its vocabulary keeps one producer for the phrasing and avoids a second
wording that drifts from the game's own.

Alternative considered: composing a sentence in the site. Rejected because the comparison vocabulary is
the game's and a local phrasing would restate it.

### Attribute to the holder, and bind a line only where the graph binds it

Two link planes carry these graphs. The flow plane is `Connection` objects, where a probe found
`BranchRelationshipNode` as a direct source of `SpeakFlowNode`. The value plane is FlowCanvas ports, and
`FactionCheck`, `RelationshipCheck` and `RaceCheck` feed `SwitchBool` in every sampled case while a
breadth-first walk over connections reached no line within six hops.

Publishing a value-plane condition against its holder is therefore honest and available now. Claiming a
line for it would require resolving port bindings, and asserting one without that model would attach a
condition to whichever line happened to be nearby.

Alternative considered: resolving the port model in this change. Rejected as a separate mechanism with its
own risk, which would hold the readable part of the data behind it. The unbound count keeps the gap
measured rather than forgotten.

### Resolve subjects from assets, never from names

A faction's asset name and its published name differ: `faction_region_wetlands` is published as "Garako
Wetlands Region". Matching on either string would break on the next rename, so subjects resolve through
the existing asset reference mechanism, which already yields stable ids.

### Decide race groups when the data demands it

`RaceGroup` carries an id, a name and an icon, and races already form a published family. Whether a group
becomes a page or a label depends on how many groups a build carries and whether anything else references
them, which this change measures before choosing. Until then a group condition carries the group's name
and id.

## Risks / Trade-offs

- [A holder-level condition may read as gating every line in the graph] → Word it as a check the graph
  declares, and report the unbound count so the surface never implies per-line precision.
- [The tier vocabulary may change between builds] → Publish the game's names as data rather than as
  hardcoded strings, and let an unknown tier surface as a diagnostic.
- [Two link planes invite a wrong binding] → Bind only across flow connections, and test that a
  value-plane condition yields no line.
- [Race groups may not warrant a page] → Carry name and id first; a page is a later decision with its own
  evidence.

## Migration Plan

1. Land `authored-dialogue`, which introduces the shared walk and holder attribution.
2. Add condition DTOs and read the three condition kinds plus the tier branch.
3. Canonicalise, resolve subjects, and register the subject predicates.
4. Add fixtures, including a condition that binds to no line.
5. Render conditions beside dialogue, then verify a character page in a browser against a live export.

Rollback drops the condition tables and the section; dialogue is unaffected.

## Open Questions

- Whether the value-plane port model is worth a later change, which depends on how many conditions remain
  unbound in a live export.
- Whether race groups become pages or labels.
