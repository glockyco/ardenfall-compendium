## Why

The instructions that steer work on this repository state the same requirement in three places and leave the highest-value practice unwritten. `entity.json` as the only source of truth and fail-fast both appear in `.omp/RULES.md` and in `openspec/config.yaml`; clean cutover appears in `AGENTS.md` and in `openspec/config.yaml`. That breaks the repository's own rule that one fact has one producer, and it is worse than untidy: `omp` drops an always-apply rule whose content already appears in a loaded context file, so duplicating a sticky requirement into `AGENTS.md` can delete the sticky copy.

Two lines have also decayed. `AGENTS.md` names two of the five site smokes in its gate list and refers to `skill://commit`, which does not exist; the skill is `commit-policy`. Both were followed from memory rather than from the file during the identity slice, which is how the drift went unnoticed.

The unwritten practice is the one that mattered most. Every design decision in the player-facing identity slice that survived contact with the game came from a spike against the decompiled source or the running game, and every decision made without one was wrong. Spikes established that a reader-facing race is the topmost record in a chain resolving the same name, not the nearest authoring ancestor, because `race_karu-elf_male` re-authors the name its parent authored; that `CharacterData.CharName` generates a name from the race and writes it back when read while the game runs; that 298 of 320 character records are authored and 22 are runtime-created; that six authored records share one `RecordID`; and that the build holds 27 loadable cell scenes rather than the 683 cells three plan documents claimed. Reasoning without a spike produced three wrong claims in the same slice, including an empty-vocabulary defect that did not exist, because the probe read `variant.nameSets` when the published field is `variant.nameSetRefs`.

The same slice shows the cost of trusting our own artefacts. A window of `registry.ts` appeared to show `npc` with no read-model phase, and a design decision rested on that reading until the diff showed the phase was there. A query read `variant.nameSets`, which does not exist, and its empty result was written up as a missing-vocabulary defect. The redirect mechanism was extended, wired through the CLI and covered by tests before anyone noticed it had never written a row, because its emitter filtered a source type nothing produced.

`openspec/config.yaml` already says to ground claims in decompiled source and confirm shape with a live export. Nothing makes that operational: there is no spike workflow, no home for probes, no requirement that a measurement be recorded, and no rule that an empty result is not evidence.

## What Changes

- Give each kind of statement one home. `.omp/RULES.md` keeps hard requirements about this repository. `AGENTS.md` keeps orientation, commands and what counts as verified. `openspec/config.yaml` keeps only planning-time artifact rules plus a pointer, losing its duplicated copies of repository requirements.
- Record the working-style requirements that flip decisions, in the user-level rules where they belong, because they are not specific to this repository: prefer the complete fix and record rather than ship a compromise; fix or record an adjacent defect of the same class; fix the class rather than the instance; treat a subagent report as a claim; require a measurement for a behaviour claim.
- Make the spike practice operational in `skill://live-extraction`: a question, a probe, a recorded measurement, and a positive control for any negative result. Probes live in a gitignored `spikes/` directory because they are version-specific and disposable; measurements land in the evidence ledger under `docs/plans/`.
- Add an export preflight that fails when more than one instrumented game holds the HotRepl port, which silently answered an export from a stale mod during the identity slice.
- Add rules that fire on the tool arguments introducing a named anti-pattern, interrupting for `--no-verify`, for a source-text assertion inside a test or smoke, and for a defaulted NOT NULL column in pipeline SQL; reminding for the rest.
- Make the decayed and duplicated parts checkable rather than reviewed: tests that the gate list matches the package scripts, that every `skill://` reference resolves, and that no requirement sentence appears in two homes.
- State the boundary between `docs/plans/` and `openspec/`: specs own what must be true, changes own what is in flight, plans own audits, measurements and slice evidence. Slice status is read from `openspec list` rather than restated in prose.

No entity descriptor, public route or relationship predicate changes. This change adds no reader-facing behaviour; it changes how the repository instructs the agents that work on it, and it adds three tests plus one controller preflight.

## Capabilities

### New Capabilities

- `agent-instructions`: where each kind of instruction lives, which of them are enforced by tests, and what a stale or duplicated instruction must do.
- `evidence-standard`: what counts as evidence for a claim about behaviour, in the game or in this repository, how a spike is run and recorded, and the preflight that keeps an export honest.

### Modified Capabilities

None. The existing specs describe published compendium behaviour, which this change does not touch.
