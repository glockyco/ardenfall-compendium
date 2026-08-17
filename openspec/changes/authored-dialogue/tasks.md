## 1. Shared graph walk

- [ ] 1.1 Add the graph walk that yields a graph's nodes, reading the container's `graph` field through a
      flattened field lookup rather than a property.
- [ ] 1.2 Add the corpus DTOs: line text, node kind, ordinal, holder reference, speaker reference.
- [ ] 1.3 Cover the walk with tests, including a container whose graph is absent and a graph with no
      nodes.

## 2. Holders

- [ ] 2.1 Move the existing `CharacterQuestObject` dialogue walk onto the shared walk, keeping its output
      byte-identical.
- [ ] 2.2 Add the `CharacterGroupQuestObject` and `SimpleDialogSceneQuestObject` holders.
- [ ] 2.3 Add the `CharacterData.characterGraphs` holder, reading only containers whose graph is a
      dialogue graph.
- [ ] 2.4 Read `SpeakFlowNode.statement` and `otherStatements` beside the existing greeting and topic
      nodes.
- [ ] 2.5 Resolve a speaker when the node names one, and emit no speaker when it does not.
- [ ] 2.6 Report graphs walked and lines yielded per holder kind.

## 3. Pipeline

- [ ] 3.1 Add the canonical dialogue table with holder attribution, replacing the nested quest rows.
- [ ] 3.2 Emit read models for the character and quest surfaces.
- [ ] 3.3 Report per-holder counts in the run manifest.
- [ ] 3.4 Count and report a line whose holder resolves to no published entity, and publish none of them.
- [ ] 3.5 Add pipeline tests for attribution, for a reused line, and for an unresolvable holder.

## 4. Site

- [ ] 4.1 Read the corpus in `DialogueSection.svelte`, collapsing repeated text for reading.
- [ ] 4.2 Render character-graph lines on the character page with no quest required.
- [ ] 4.3 Keep quest pages listing the lines whose holder is that quest's object.
- [ ] 4.4 Keep the rendered corpus inside the indexed region.

## 5. Fixtures and budget

- [ ] 5.1 Add synthetic fixtures for a character-graph line, a group line, a scene line, a reused line, a
      line with no speaker, and a holder that yields none.
- [ ] 5.2 Measure the Pagefind index size and the deploy file count against the gate, and record the
      measurement in this change.
- [ ] 5.3 Run the repository gate in `AGENTS.md` - Commands.

## 6. Live verification

- [ ] 6.1 Export from the running game and compare per-holder counts against the probe in
      `spikes/graph-survey.json`.
- [ ] 6.2 Build the site from that export and open a character page and a quest page in a browser.
- [ ] 6.3 Add any live-only shape to the synthetic fixture.
