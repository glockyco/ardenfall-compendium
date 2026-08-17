## Context

See `proposal.md` - Why for the measurements. Decompiled paths are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`.

- `Ardenfall/Nodes/GraphContainer.cs:41` declares `public T graph` as a field on a generic base, so a
  reflection-based reader must look for a field and flatten the hierarchy. Reading it as a property
  silently finds nothing.
- Dialogue holders: `Ardenfall/CharacterData.cs:88` `characterGraphs`, plus `dialogGraph` on
  `Ardenfall/Questing/CharacterQuestObject.cs:19`, `CharacterGroupQuestObject.cs:31` and
  `SimpleDialogSceneQuestObject.cs:18`. `Ardenfall/CharacterModule.cs:15` holds a further
  `characterGraphs` list.
- `Ardenfall/Dialog/Nodes/SpeakFlowNode.cs` exposes `statement` and `otherStatements` as public fields,
  and names a speaker through `CharacterGraphRef` fields.
- `LoadedQuestAssetSource` already reads `GreetingFlowNode` and `TopicFlowNode`, and records beside the
  code why it reads the authored `statement` field rather than `GetTopicStatements`.

## Goals / Non-Goals

**Goals:**

- One graph walk used by every holder and reused by `quest-scripting`.
- A dialogue corpus with holder attribution, so a line has a home and a provenance.
- Coverage counts per holder in the export.

**Non-Goals:**

- No graph evaluation, and no ordering of lines into a conversation. A line is authored text with a
  holder, not a path through a graph.
- No conditions. `dialogue-conditions` proposes them, because a probe measured the authored condition
  payloads as declarative and resolvable rather than as semantics the compendium cannot support.
- No translation, and no substitution of runtime tokens.
- No barks. `BarkAsset` carries an expression and no prose, so the bark system adds no readable line.
- No AI behaviour trees.

## Decisions

### One walk, several holders

Each holder differs only in how its graph is reached. The walk takes a graph and yields its nodes; each
holder contributes a small adapter that finds its graph and names the owning entity. `quest-scripting`
reuses the same walk for logic graphs, which is why this change lands first.

Alternative considered: extending the existing quest dialogue walk in place. Rejected because it would
leave the character-graph corpus, the largest holder, reachable only through a quest.

### Attribute a line, and do not reconstruct a conversation

A line carries its holder, its node kind, its ordinal within the graph, and a speaker when the node names
one. It does not carry a parent line or a branch condition.

A conversation is a path chosen at runtime from relationship values, faction membership and quest state.
The checks themselves are authored and publishable, which is what `dialogue-conditions` proposes; the
path taken through them is not, because it needs a live player. Publishing an authored node order as if
it were a conversation would state the second while only holding the first.

### Deduplicate for reading, not for storage

The same authored line can be reached through several holders. Storage keeps one row per holder so
provenance survives an author moving a line, and presentation collapses repeated text on a page. This
follows the repository's rule that one fact has one producer: the corpus produces rows, the page produces
the reading order.

### Take the text before the runtime touches it

The runtime rewrites a statement with a debug prefix or a failed-check alternative, so the authored field
is both the stable value and the one a reader wants. This repeats the choice the existing topic walk made
and keeps its reason.

### Measure the search budget before publishing the corpus

The deploy gate fails above 20,000 files and the site currently indexes a small corpus. Adding an order
of magnitude of prose changes the Pagefind index, so the slice measures the index size and file count
against the gate before the corpus reaches a release artifact.

## Risks / Trade-offs

- [The corpus grows the search index] → Measure the index against the deploy budget in the same slice,
  and record the measurement in the export rather than in a comment.
- [A line's holder may have no published page] → Count and report such lines; render none of them.
- [Quest dialogue rows change shape] → The change is declared breaking for that read model, and the quest
  surface reads the corpus filtered by holder.
- [Load order affects how many graphs are visible] → Report graphs walked per holder so a drift is
  visible in the manifest; `authored-content` already forbids a count that depends on the session.
- [A build moves dialogue between holders] → Holder attribution makes the move visible as a shift in
  per-holder counts rather than as vanished prose.

## Migration Plan

1. Add the shared graph walk and the corpus DTOs, with the holder adapters.
2. Move the existing quest dialogue walk onto the shared walk, keeping its output identical.
3. Add the character-graph, group and scene holders.
4. Canonicalise the corpus, emit read models, and update the quest and character surfaces.
5. Measure the Pagefind index and the deploy file count.
6. Verify a character page and a quest page in a browser against a live export.

Rollback restores the nested quest dialogue read model; the corpus tables are additive and can be dropped.
