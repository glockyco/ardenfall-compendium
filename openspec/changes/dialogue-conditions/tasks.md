## 1. Extraction

- [ ] 1.1 Add condition DTOs: kind, subjects, comparison, tier, holder reference, and an optional line
      reference.
- [ ] 1.2 Read faction checks, race-group checks and relationship thresholds through the shared graph
      walk from `authored-dialogue`.
- [ ] 1.3 Resolve each subject through the asset reference mechanism, never through a display name, and
      emit a missing reference with a reason when it does not resolve.
- [ ] 1.4 Bind a line to a relationship tier where a flow connection carries the branch directly, and
      leave the line reference empty otherwise.
- [ ] 1.5 Report conditions read and conditions unbound per holder kind.
- [ ] 1.6 Cover the walk with tests: each condition kind, an unresolved subject, a tier branch that binds
      a line, and a value-plane condition that binds none.

## 2. Pipeline

- [ ] 2.1 Add the canonical condition table with holder attribution and the optional line reference.
- [ ] 2.2 Emit read models for the character and quest dialogue surfaces.
- [ ] 2.3 Register predicates for condition subjects, and emit edges to factions and race groups only
      where the target is published.
- [ ] 2.4 Report the per-holder counts in the run manifest.
- [ ] 2.5 Add pipeline tests for subject resolution, tier binding, and the unbound count.

## 3. Presentation

- [ ] 3.1 Render conditions beside dialogue, using the game's comparison vocabulary.
- [ ] 3.2 Link a faction or race-group subject to its published page.
- [ ] 3.3 Show a tier-bound line with the tier that selects it.
- [ ] 3.4 Word every surface as a check the graph declares, with no availability or reachability claim.

## 4. Fixtures and gates

- [ ] 4.1 Add synthetic fixtures for a faction condition, a relationship threshold, a race-group
      condition, a tier-bound line, an unresolved subject, and a condition bound to no line.
- [ ] 4.2 Run the scoped pipeline, site and mod suites.
- [ ] 4.3 Run the repository gate in `AGENTS.md` - Commands.

## 5. Live verification and open questions

- [ ] 5.1 Export from the running game and record conditions read and unbound per holder.
- [ ] 5.2 Decide from that measurement whether race groups warrant pages or labels, and record the
      decision in this change.
- [ ] 5.3 Record whether the unbound remainder justifies a later change for the value-plane port model.
- [ ] 5.4 Build the site from that export and verify a character page in a browser.
