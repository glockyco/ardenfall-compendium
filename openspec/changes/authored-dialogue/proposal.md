## Why

The compendium publishes the game's prose everywhere it can reach it: item descriptions, enchantment
text, journal entries, spell tooltips. It reaches roughly a tenth of the game's authored dialogue,
because it opens one of the four places dialogue is authored.

A read-only probe of Ardenfall Demo `0.0.10.91` measured the corpus. Every number comes from
`spikes/graph-survey.json`.

- The build carries **4,365 authored dialogue lines, 1,779 of them distinct, over 459,371 characters of
  prose**, in `DialogFlowGraph` graphs on `CharacterData.characterGraphs`, alongside 744 greeting nodes
  and 932 topic nodes.
- The export publishes **484 lines and 32,927 characters**, all from `CharacterQuestObject.dialogGraph`.
  That is one line published for every nine authored, and one character of prose for every fourteen.
- Three dialogue holders are never opened: `CharacterData.characterGraphs`, which holds 271
  `DialogFlowGraph` graphs among its 1,503 containers, and the dialogue graphs on
  `CharacterGroupQuestObject` (8 of 18 objects) and `SimpleDialogSceneQuestObject` (17 of 17).
- The lines are plain authored fields. `SpeakFlowNode` exposes `statement` and `otherStatements` as
  public fields, and the existing walk already reads `GreetingFlowNode` and `TopicFlowNode` the same way.
- The gap was invisible because a comment in `LoadedQuestAssetSource` recorded 196 containers with a
  single `DialogFlowGraph`, measured from a smaller loaded set. Commit `7866696` removed that count; this
  change removes the gap.

For a reader this is the difference between a character page that lists a few quest lines and one that
carries what the character actually says. It is also the largest single addition available to search: the
site indexes 499 words today.

## What Changes

- Add one graph walk that visits the nodes of any authored graph, shared by every dialogue holder and
  reused by `quest-scripting`.
- Extract authored lines from every dialogue holder: character graphs, and the character, group and
  scene quest objects.
- Attribute each line to the entity that owns the graph it came from, and to the speaker the node names
  when it names one.
- Keep the authored text as written, before any runtime substitution, and record the node kind that
  carried it.
- Report per-holder line counts and the count of graphs walked, so a holder that stops yielding lines is
  visible in the export rather than in a reader's page.
- Deduplicate for presentation without discarding provenance: one line authored once and reused by
  several graphs remains one row per holder.

**BREAKING** for the quest dialogue read model: dialogue becomes a corpus with its own identity and
holder attribution rather than a field nested under a quest character, and the site reads the new shape.

## Capabilities

### New Capabilities

- `authored-dialogue`: the authored dialogue corpus, the holders it is read from, the shared graph walk,
  the attribution of a line to its owning entity and speaker, and the per-holder coverage counts.

### Modified Capabilities

- `character-catalogue`: its dialogue presentation requirement binds a line to the quest that owns the
  graph. A line held by a character's own graph has no owning quest, so the requirement gains that case.

`authored-content` is unchanged: it already requires extraction to read authored backing data rather than
a generating accessor, and this change follows it by reading `statement` rather than the runtime topic
accessor.

## Impact

- `mod/src/Entities/Quest/LoadedQuestAssetSource.cs`: its dialogue walk moves to the shared walk.
- `mod/src/Walker/` or a new dialogue extraction service: the shared graph walk and the corpus DTOs.
- `mod/src/Entities/Character/`: character graphs become a dialogue source.
- `pipeline/src/entities/`: a canonical dialogue table with holder attribution, replacing the nested
  quest dialogue rows.
- `site/src/lib/components/content/DialogueSection.svelte`: reads the corpus shape.
- Pagefind: the indexed corpus grows by an order of magnitude, so the index budget needs a measurement.
- `fixtures/synthetic/snapshot`: a character-graph line, a group-object line, a scene-object line, a
  reused line, and a graph that yields none.
- The Alpha build is unmeasured. Every count above describes the Demo.
