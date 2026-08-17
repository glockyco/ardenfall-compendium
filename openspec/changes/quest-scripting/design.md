## Context

See `proposal.md` - Why for the measurements. Decompiled paths below are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`.

- A quest holds its logic graph at `Ardenfall/Questing/QuestData.cs:101`, `flowGraph`, a
  `QuestGraphContainer`. `Ardenfall/Nodes/GraphContainer.cs:41` declares `public T graph`, a field
  rather than a property, on a generic base.
- `QuestData.objects` holds the quest's objects, and the subject of a location trigger is a
  `LocationQuestObject` in that list.
- The graph node classes are ordinary serialised types with public fields, so a walk reads authored
  values without evaluating anything. `OnEnterQuestLocation` exposes `locationObject` and `character`;
  `OnGetItemNode` exposes `itemFilterList`; `TriggerSteamAchievementNode` exposes
  `steamAchievementName`.
- `LoadedQuestAssetSource` enumerates quests with `Resources.FindObjectsOfTypeAll<QuestData>()`.

## Goals / Non-Goals

**Goals:**

- One graph walk, shared with `authored-dialogue`, that visits a graph's nodes and reports a census.
- Authored trigger and effect rows whose subjects resolve to existing entity references.
- Item grants that reach item pages as inbound relationship edges.

**Non-Goals:**

- No graph evaluation. The walk reads authored fields; it never runs a node, resolves a variable, or
  decides whether a branch is taken.
- No quest-variable semantics. `SetQuestVariable` and `CheckQuestVariable` are counted, not interpreted.
- No AI behaviour trees, and no barks. `BarkAsset` carries an expression and no prose.
- No reachability claim, and no ordering claim about which trigger fires first.

## Decisions

### Walk authored fields, and never evaluate a graph

A node's authored value is a serialised field. Evaluating a graph would need live quest state, a
blackboard and a player, which an extraction pass does not have and must not invent. The dialogue walk
already made this choice for `TopicFlowNode`, reading the authored `statement` rather than calling
`GetTopicStatements`, and recorded why beside the code.

### Model the node vocabulary, not the node graph

The extraction publishes rows for the node kinds it models and a census for every kind it meets. It does
not publish edges between nodes, so a build that rewires a graph without changing its authored subjects
produces the same rows.

Alternative considered: exporting the whole node graph and letting the pipeline interpret it. Rejected
because the reader-facing question is "what does this quest grant, and what starts it", and a published
node graph would put the game's authoring structure into a public contract that the next build breaks.

### An unmodelled node type is a diagnostic, not a silent gap

93 node types appeared in a first census of 13 quests and 155 in the full 38, so the vocabulary is wider
than any slice models. A build that introduces a node kind must make that visible, which is why the
census is a requirement rather than a debugging aid. This follows the repository's fail-fast rule for
missing source-of-truth data.

### Take the quest population from one place, and record which

The quest source enumerates loaded assets. A probe measured 38 loaded quest assets against 13 registered
in `BuiltLookupTable`, and the loaded `CharacterData` population drifted from 889 to 903 within one
session while the registered count stayed at 212.

`authored-content` requires two exports of one build and save to produce equal row counts, so this change
must not add a family whose count moves with load order. The implementation keeps the existing quest
population, and the export records the population size it walked so a drift becomes visible in the
manifest rather than in a reader's page. Changing the population itself is out of scope and belongs to
its own change, because it would move existing published quest rows.

### Counts live in the export, not in the source

Every measurement in this change belongs to the probe artifacts and to the export manifest. A count in a
comment goes stale with the next build, and this repository already carried three such comments.

## Risks / Trade-offs

- [155 node types, a handful modelled] → The census makes coverage measurable, and an unmodelled type is
  reported per build rather than discovered by a reader.
- [An item grant is not a promise a reader can obtain the item] → Publish the authored grant and the
  quest that declares it, and never phrase it as availability.
- [A trigger's subject may resolve to no entity] → Keep the row, carry a missing reference with a reason,
  and let the existing relationship audit reject only edges whose target should exist.
- [Quest logic changes between builds] → Rows key on authored subjects, not on node identity, so a
  rewired graph with the same grants produces the same rows.

## Migration Plan

1. Land `authored-dialogue`, which introduces the shared graph walk.
2. Add the trigger and effect DTOs and the walk over `QuestData.flowGraph`, with the census.
3. Canonicalise the rows, then emit read models and register the predicates.
4. Add fixtures for a grant, a trigger, an achievement id and an unmodelled node type.
5. Render the sections, then verify a quest page, an item page and a location page in a browser against a
   live export.

Rollback removes the emitters and the tables; no existing published contract changes.
