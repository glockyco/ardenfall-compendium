## 1. The graph walk

- [x] 1.1 Grow `DialogueGraphWalk` from a line reader into a graph reader: nodes with an id, edges with source, target, order and output label, read from `inConnections` and `outConnections`.
- [x] 1.2 Add the role adapter table. Map a node type to a role and extract that role's payload. An unmapped type yields the role `unmodelled` with its authored type name.
- [x] 1.3 Contract control nodes by joining their inbound edges to their outbound edges, and publish a jump node with its target instead of contracting it.
- [x] 1.4 Read a speech node as an ordered statement list from `statement` and `otherStatements`, with the `singleScreen` flag.
- [x] 1.5 Read a gate as a subject, a comparison and a compared value for `FactionCheck`, `RaceCheck`, `RelationshipCheck` and the quest checks, and record an unresolved subject as a diagnostic rather than inventing one.
- [x] 1.6 Read an outcome as a kind, an amount and a reference for the thirteen kinds the corpus holds.
- [x] 1.7 Cover the walk in `mod-tests` with plain data: contraction over a control chain, a jump that keeps its target, a join node with two inbound edges, a speech node with continuation screens, and an unmapped type that keeps its edges.

## 2. Holders

- [x] 2.1 Add a holder adapter per dialogue holder: `CharacterData.characterGraphs`, `CharacterModule.characterGraphs`, `CharacterQuestObject.dialogGraph`, `CharacterGroupQuestObject`, `SimpleDialogSceneQuestObject`, and the scene placement the cell walk already harvests.
- [x] 2.2 Publish one conversation per graph asset with every holder that reaches it, and report the conversations found per holder in the manifest.
- [x] 2.3 Report the node count per role, the statement count, the authored character count and the unmodelled count per type.

## 3. Canonical data

- [x] 3.1 Add the `dialogue` descriptor with its canonical table and no map layer of its own.
- [x] 3.2 Add the DDL: `dialogues`, `dialogue_nodes`, `dialogue_edges`, `dialogue_statements`, `dialogue_conditions`, `dialogue_effects`, `dialogue_holders`.
- [x] 3.3 Canonicalise the envelope into those tables, and fail a conversation whose edge names a node the envelope does not carry.
- [x] 3.4 Resolve every gate subject and outcome target through the existing reference machinery, and diagnose a reference that resolves to nothing.

## 4. Read models and the graph

- [x] 4.1 Emit `dialogue_script_rows` with the reader-shaped script: openers in authored priority order, choices with replies and outcomes, nested follow-ups, labelled branch alternatives, and loop markers where an edge returns to a node already on the path.
- [x] 4.2 Translate every statement through the rich-text contract, and report an unsupported tag or an unresolved runtime token as a diagnostic.
- [x] 4.3 Declare the gate and outcome predicates in the relationship registry, and project an edge per resolved subject and target.
- [x] 4.4 Emit the conversation list each holder page needs, with the holder that reaches each conversation.

## 5. The conversation page

- [x] 5.1 Add the conversation route and page: openers with gates, choices with gates, replies, outcomes with amounts and links, nested follow-ups, branch alternatives with their labels, and loop links.
- [x] 5.2 Render depth with `<details>` disclosure, with every statement in the prerendered HTML and no client graph layout.
- [x] 5.3 State the absent cases: a conversation with no choice, a gate with no resolvable subject, and an outcome whose target has no page.
- [x] 5.4 List conversations on the character, quest and scene dialogue pages, each linking to the conversation page.
- [x] 5.5 Name the conversations on the pages a gate or an outcome reaches: item, location, faction, character and quest.

## 6. Cutover

- [x] 6.1 Remove `scene_dialogue.lines_json`, `scene_dialogue_presentation_rows.lines_json` and the lines block of `SceneDialogueDetail.svelte`.
- [x] 6.2 Remove `quest_character_dialogue`, `quest_character_dialogue_rows`, `site/src/lib/server/entities/dialogue.ts` and `DialogueSection.svelte`, and update the quest and character pages to the conversation list.
- [x] 6.3 Update the tests that pin the flat contracts, and delete the ones that pin removed wording.

## 7. Fixtures and verification

- [x] 7.1 Extend the synthetic snapshot with one conversation that carries: two gated openers of different priority, two choices with outcomes, a nested follow-up, a relationship branch with two labelled outputs, a loop back to the choice list, a join node with two inbound edges, a speech node with two screens, and one unmodelled node type.
- [x] 7.2 Add the pipeline tests for contraction, linearisation with a loop marker, and predicate projection, and the site tests for the script read model.
- [x] 7.3 Run the full gate in `AGENTS.md`, then a live export, and record the published corpus against the build: conversations, nodes per role, statements, authored characters, and unmodelled types.
- [x] 7.4 Verify a conversation in a browser against a live export: the demo teleporter answers what each topic awards and why one greeting closes the conversation.
- [x] 7.5 Verify the largest conversation in a browser for readability and for search, and confirm a collapsed statement is findable.

## 8. Documentation and cleanup

- [x] 8.1 Remove the `authored-dialogue` and `dialogue-conditions` changes, whose decisions this change supersedes.
- [x] 8.2 State in `quest-scripting` that it reuses this walk for quest logic graphs.
- [x] 8.3 Carry the probes that measured the corpus into this change, and record the measured node roles and graph shapes beside them.
- [x] 8.4 Archive this change after the gate passes.
