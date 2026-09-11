## Why

A reader who finds a conversation asks three questions: who speaks, what can I say, and what happens
if I say it. The compendium publishes a flat list of lines, so it answers none of them. The page for
the demo teleporter lists two topics and two greetings in one column, with the greetings last, and
implies a reading order the data does not have.

The answers are authored data, and a read-only probe of Ardenfall Demo `0.0.10.91` measured them.

- 231 `DialogFlowGraph` assets hold 11,010 nodes and 10,399 authored edges. The edges are the
  conversation. The published model drops every one of them.
- The nodes fall into six reader-facing roles: speech 3,805, control 2,973, effect 1,374, choice
  1,168, condition 1,016, branch 397. Control nodes are plumbing, and they are 27 percent of the
  graph.
- A choice carries consequences the page never shows. In `dia_inter_demo-teleporter`, the AKAGA topic
  awards 200 experience and 100 gold and then teleports the character, and the CRAGS topic awards 500
  and 300.
- A greeting is an alternative, not the next line. The second greeting of that graph runs behind a
  check of `PlayerCharacter.IsInBattleMode` and closes the conversation, so a player in combat never
  reaches the topics.
- A speech node holds a sequence of statements, not a line. 1,092 nodes carry continuation screens in
  `otherStatements`, which the current line count hides.
- The graphs are graphs. 1,383 nodes have more than one inbound edge, 1,077 have more than one
  outbound edge, and 949 jump nodes return the reader to an earlier point. A tree cannot hold them.
- The vocabulary has a long tail. 147 distinct node types appear, and 53 of them appear three times
  or less. A model with one case per type decays with the next build.

Half of the corpus is also unreachable today. The export opens one of four dialogue holders, which
publishes 484 lines of the 4,365 the build authors.

This change replaces the flat list with the authored flow, and it replaces two earlier plans,
`authored-dialogue` and `dialogue-conditions`, whose measurements and decisions move into it. Those
plans separated the corpus, the conditions and the presentation into three changes, and each one
would have published a shape this change then rewrites.

## What Changes

- **BREAKING** Retire the flat line contracts. `scene_dialogue.lines_json` and
  `quest_character_dialogue_rows` go, and both pages render the flow.
- Publish authored dialogue as a graph: nodes with a role, edges with their authored order and
  branch label, statements as ordered screens, conditions as declarations, and effects as typed
  outcomes.
- Contract the control nodes. A published edge joins two nodes a reader cares about, and a jump
  becomes a marker that names where the conversation returns to.
- Count what the model does not hold. An unmodelled node type reaches the manifest as a number, so
  the next build's new node type arrives as a count rather than as silence.
- Open every dialogue holder: `CharacterData.characterGraphs`, `CharacterModule.characterGraphs`,
  `CharacterQuestObject.dialogGraph`, `CharacterGroupQuestObject`, and
  `SimpleDialogSceneQuestObject`.
- Render a conversation page: the openers with their gates, the choices with their gates, replies and
  outcomes, nested follow-up choices, labelled branches, and loop markers. The page prerenders as
  nested disclosure, so it needs no canvas and no client graph layout.
- Link a conversation to the entities it names. An outcome that grants an item, moves a character to
  a location, changes a faction relationship or advances a quest becomes a relationship edge.
- Publish an effect and condition vocabulary the site renders as prose, with the game's own wording
  for list comparisons.

## Capabilities

### New Capabilities

- `dialogue-flow`: the authored dialogue graph as published data. Roles, edges, statements,
  conditions, effects, control contraction, loop markers, holder attribution, and the counts that
  prove coverage.
- `dialogue-presentation`: the conversation page. What a reader sees for an opener, a choice, a
  reply, an outcome, a branch and a loop, and what the page states when the data is absent.

### Modified Capabilities

- `world-dialogue`: scene dialogue keeps its identity and its placements, and its lines requirement
  becomes the flow contract.
- `character-catalogue`: the dialogue a character speaks renders as conversations rather than as
  lines.
- `relationship-graph`: adds the predicates that connect a conversation to the items, locations,
  factions, characters and quests its conditions and outcomes name.

## Impact

- `mod/`: one dialogue graph walk that reads nodes, edges, statements, conditions and effects, with
  an adapter per holder. `DialogueGraphWalk` grows from a line reader into a graph reader.
- `pipeline/`: a dialogue entity family with node, edge, statement, condition and effect tables, a
  reader-shaped script read model, map and relationship projections, and manifest counts.
- `site/`: a conversation page and its components, and the removal of the two flat line components.
- `openspec/`: `authored-dialogue` and `dialogue-conditions` retire into this change.
  `quest-scripting` keeps its own plan and reuses this walk.
