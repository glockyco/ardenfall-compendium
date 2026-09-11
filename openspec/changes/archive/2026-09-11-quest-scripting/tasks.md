## 1. Mod extraction

- [x] 1.1 Add the trigger and effect DTOs to the quest snapshot: location-entry trigger,
      item-acquisition trigger, item grant, journal addition, quest-state effect, objective-state
      effect, phase effect, and achievement id.
- [x] 1.2 Walk `QuestData.flowGraph` with the shipped graph walk, `DialogueGraphWalk`, reading
      authored fields only.
- [x] 1.3 Resolve each subject through the existing reference mechanisms, and emit a missing reference
      with a reason when a subject does not resolve.
- [x] 1.4 Report the node-type census and the walked population size, and emit a diagnostic naming any
      node type the walk does not model.
- [x] 1.5 Cover the walk with tests through a fake asset source, including an unmodelled node type and an
      unresolved subject.

## 2. Pipeline canonicalisation

- [x] 2.1 Add canonical tables for the trigger and effect rows, with the descriptor field contract.
- [x] 2.2 Emit read models for quest, item and location surfaces.
- [x] 2.3 Register the quest-to-item and quest-to-location predicates, and emit edges only where both
      ends are published entities.
- [x] 2.4 Report per-kind counts in the run manifest.
- [x] 2.5 Add pipeline tests for the tables, the read models and the edges.

## 3. Site presentation

- [x] 3.1 Render a quest's authored triggers and grants through the shared relationship surface.
- [x] 3.2 Show the granting quest on an item page, so a granted item gains an inbound link.
- [x] 3.3 Show a location's quest triggers on the location page.
- [x] 3.4 Word every surface as an authored declaration, with no reachability claim.

## 4. Fixtures and gates

- [x] 4.1 Add synthetic fixtures for an item grant, a location trigger, an achievement id, an unresolved
      subject and an unmodelled node type.
- [x] 4.2 Run `bun test pipeline/test`, `bun test site/test` and the mod test suite.
- [x] 4.3 Run the repository gate in `AGENTS.md` - Commands.

## 5. Live verification

- [x] 5.1 Export from the running game and confirm the census and the manifest counts.
- [x] 5.2 Build the site from that export and open a quest page, a granted item page and a location page
      in a browser.
- [x] 5.3 Record the measured counts in this change, and add any live-only shape to the synthetic
      fixture.
