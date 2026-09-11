## Context

Measurements come from read-only HotRepl probes against Ardenfall Demo `0.0.10.91`, over the 231
`DialogFlowGraph` assets loaded at the main menu. Decompiled paths are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`.

- `NodeCanvas.Framework.Node` exposes `inConnections` and `outConnections` as public lists of
  `Connection`, and `Connection` exposes `sourceNode` and `targetNode`
  (`ParadoxNotion.dll`, decompiled: `Graph.cs` region, `Node` at line 4909, `Connection` at 2415).
  The edges are ordinary public data, so a reader needs no graph runtime.
- `Ardenfall/Dialog/Statement.cs:17` carries `text`, an icon and an id.
  `Ardenfall/Dialog/Nodes/SpeakFlowNode.cs:19` holds one `statement` and `:21` a list of
  `otherStatements`. `SpeakFlowNode.NextSpeech` walks that list as continuation screens, and
  `SpeakFlowNode.SpeechSingleScreen` joins them into one block when `singleScreen` is set.
- `Ardenfall/Dialog/Nodes/TopicFlowNode.cs:44` holds `enableCheck` with a `ChoiceCheck`, so a choice
  carries its own gate.
- `Ardenfall/Nodes/XPNode.cs:24` holds an `amount` enum with a custom `addAmount`,
  `Ardenfall/Nodes/ModifyMoneyNode.cs:18` an `addAmount`, and
  `Ardenfall/Nodes/TeleportCharacterToLocationNode.cs:12` a `QuestObjectGraphRef location`. Outcomes
  are authored fields.
- Probe of `dia_inter_demo-teleporter`: nodes `0→1→2→3→4→5→6` run topic, call, speech, experience
  200, money 100, finish, teleport. Nodes `7→…→13` run the same chain with 500 and 300. Nodes
  `21→22→18` gate the second greeting on `PlayerCharacter.instance` and `Is In Battle Mode`, and
  greeting `18` runs to `FinishDialogFlowNode`, which closes the conversation before any topic.
- Population: 11,010 nodes, 10,399 edges, 147 distinct node types. Roles: speech 3,805, control
  2,973, effect 1,374, choice 1,168, condition 1,016, branch 397, other 277. 53 types appear three
  times or less, and together they are 95 nodes.
- Shape: 1,383 nodes have more than one inbound edge, 1,077 have more than one outbound edge, 949 are
  `GoTo*` jumps, and 1,092 speech nodes carry continuation statements. Nodes per graph: median 29,
  p90 111, max 396. Topics per graph: median 3, max 26. 50 graphs carry no topic.
- The shipped contracts this change removes: `scene_dialogue.lines_json` with
  `scene_dialogue_presentation_rows.lines_json` (`pipeline/src/sql/scene-dialogue-ddl.ts`), and
  `quest_character_dialogue` with `quest_character_dialogue_rows`
  (`pipeline/src/sql/quest-ddl.ts:56`, `pipeline/src/entities/quest/read-models.ts:30`).
- `mod/src/Entities/Dialogue/DialogueGraphWalk.cs` already reads greeting and topic text, and records
  why it reads the authored `statement` field rather than `ITopicNode.GetTopicStatements`.

## Goals / Non-Goals

**Goals:**

- Publish the authored graph: nodes, edges, statements, gates, outcomes, holders.
- One walk for every holder, and one presentation contract for every surface.
- A conversation page that answers what a player can say and what it causes.
- Account for every node, including the types the model does not hold.

**Non-Goals:**

- No evaluation. The extraction resolves no gate and chooses no branch.
- No runtime substitution. `Statement.ApplyModifiers` rewrites text from live blackboard values, and
  the compendium publishes the authored source text.
- No node-link diagram, and no client-side graph layout.
- No barks. `BarkAsset` carries an expression and no prose, measured over 82 assets.
- No AI behaviour trees, and no quest logic graphs. `quest-scripting` owns those and reuses this walk.

## Decisions

### 1. Role vocabulary, closed at seven, with an adapter per node type

147 node types appear, and the tail is long: 53 types of three nodes or fewer. A model with a case
per type would carry 147 branches and would still miss the next build's additions.

A node publishes a role from `speech`, `choice`, `branch`, `condition`, `effect`, `jump` and
`unmodelled`, plus its authored type name. A small adapter table maps a type to a role and extracts
that role's payload. An unmapped type publishes as `unmodelled`, keeps its edges, and is counted per
type in the manifest. That count is how the next build's new node type arrives as a number rather
than as silence, which is the same mechanism the cell walk uses for unmodelled components.

Alternative rejected: publish the raw node type and let the site branch on it. That puts 147 cases in
presentation code and breaks the rule that no component branches on identity.

### 2. Contract the control nodes, and keep the jumps

Control nodes carry no text, no gate and no outcome, and they are 27 percent of the corpus:
`FinishDialogFlowNode` 1,381, `GoToStatement` 476, `GoToLabel` 265, wrappers and variable plumbing
for the rest. A reader who sees them sees noise.

The walk contracts them: it joins each inbound edge of a control node to each outbound edge, and
publishes the transitive result. A jump node is not contracted, because it carries meaning a reader
needs: the conversation returns to a point that is already on the page. It publishes as a `jump` that
names its target.

Alternative rejected: publish every node and let the page hide the control ones. The page would then
own graph traversal, and 27 percent of the rows would exist to be skipped.

### 3. The store is a graph; the page reads a prepared script

The corpus is not a tree: 1,383 join nodes and 949 jumps. Storage therefore keeps nodes and edges,
which is the shape the game authors.

A page needs a reading order, so the pipeline computes it once: a depth-first linearisation from each
entry node, with a loop marker where an edge returns to a node already on the path, published as
`dialogue_script_rows.script_json`. The site renders that document and walks no edges. This follows
the existing rule that the site renders typed read models, and it keeps the traversal in one producer.

Alternative rejected: let the site traverse `dialogue_edges` per request. Every page would
re-implement cycle handling, and the prerender cost would grow with the largest graph.

### 4. Statements, not lines

A speech node holds an ordered list of statements, and 1,092 nodes use it. "Lines" is therefore the
wrong unit: it undercounts the prose and cannot express a two-screen reply. Statements publish with a
screen ordinal and the node records whether the game joins them into one screen.

The published count becomes statements and authored characters. A fall in either between two exports
of one build is a failure, which is the coverage guard the corpus needs.

### 5. Gates are declarations, rendered with the game's own words

`FactionCheck`, `RaceCheck` and `RelationshipCheck` hold a subject list, a comparison from a closed
vocabulary, and a compared value. `ListCompareMethodUtility.GetText` renders that vocabulary as
"Is X" and "Is Not X", so the site uses the game's phrasing rather than inventing one.

A gate that reads state the compendium cannot name, such as `Is In Battle Mode`, publishes with its
authored node type and no invented subject. The page then states that the game checks something it
cannot name, which is accurate and is not silence.

### 6. Outcomes are typed, and they link

An outcome publishes a kind, an amount and a reference. The kinds cover what the corpus holds:
experience, money, item, item list, quest state, quest phase, quest objective, quest variable,
faction relationship, character relationship, teleport, combat start, character death. Each reference
resolves through the existing asset and record reference machinery, so an outcome links to the item,
location, faction, character or quest page, and the relationship graph gains an edge in both
directions.

### 7. The page is a script with disclosure, not a diagram

Reader questions, in order: who speaks, what can I say, what happens. The page answers them in that
order.

- **Openers.** Each greeting with its gate, marked as alternatives, in authored priority order.
  `GreetingFlowNode.GetImportance` gives that order, which is what decides which opener wins.
- **Choices.** Each choice as the player reads it, with its gate, its reply statements in order, and
  its outcomes as labelled values next to it.
- **Follow-ups.** A nested choice sits inside the choice that leads to it, one level of indent per
  step.
- **Branches.** Siblings, each labelled with the output it leaves from, such as the five relationship
  tiers of `BranchRelationshipNode`.
- **Loops.** A link back to the choice the conversation returns to. The target appears once.
- **Depth.** Top-level choices are visible; their bodies are `<details>` elements, open on the
  largest graphs only when the reader asks. Half the graphs hold more than 29 nodes and the largest
  holds 396, so everything-expanded is unreadable and everything-hidden is unsearchable.

A node-link diagram was rejected on three grounds: 396 nodes do not lay out legibly, a canvas needs
client-side layout in a site that prerenders every page, and the search index would reach none of the
prose. Disclosure keeps the statements in the HTML, so Pagefind indexes the largest prose corpus in
the build, 459,371 characters.

### 8. One conversation, several holders, one page

Identity is the graph asset, which the scene dialogue slice already established for the same reason:
placements carry no stable id, and one graph placed twice is one conversation. Holders become
references on the conversation, and each holder's page links to it. No surface renders its own copy.

### 9. Clean cutover

The flat contracts go in this change: the two scene dialogue columns, the two quest dialogue tables,
`site/src/lib/server/entities/dialogue.ts`, `DialogueSection.svelte`, and the lines block of
`SceneDialogueDetail.svelte`. Keeping them beside the flow would leave two answers to one question.

## Risks / Trade-offs

- **Linearisation choice is a presentation decision.** A depth-first order is one reading of a graph,
  and a reader who expects the editor's layout will see a different order. The page states the
  structure it shows, and the underlying edges stay published, so a later view can read them.
- **Contraction can hide authored intent.** A control node that turns out to carry meaning would
  disappear into an edge. The mitigation is the unmodelled count: a type is contracted only when the
  adapter table names it as control, and an unnamed type publishes instead of vanishing.
- **Corpus size.** 231 graphs, 11,010 nodes and 459,371 characters of prose enter SQLite and the
  prerendered pages. The artifact and the deploy file count both grow, and the deploy limit is 20,000
  files. Conversations are one page each, so 231 pages of this build's holders is small against that
  limit, and the growth to watch is the artifact rather than the file count.
- **Runtime tokens stay unresolved.** `ApplyModifiers` substitutes values at runtime, so a published
  statement can contain an authored token. The rich-text contract already reports unsupported tags,
  and a token needs the same treatment rather than a silent pass.
- **Two plans retire.** `authored-dialogue` and `dialogue-conditions` are removed, and their
  measurements move here. A reader looking for them finds them in git history and in this design.
