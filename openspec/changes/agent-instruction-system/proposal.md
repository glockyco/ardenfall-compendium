## Why

Three files state the same requirements. `.omp/RULES.md` and `openspec/config.yaml` both name `entity.json` as the only source of truth. Both also state the fail-fast rule. `AGENTS.md` and `openspec/config.yaml` both state the clean-cutover rule.

Duplication breaks the rule that one fact has one producer. Duplication also removes stickiness. `omp` drops an always-apply rule when a loaded context file already contains its content. A requirement in both `.omp/RULES.md` and `AGENTS.md` can therefore lose its sticky copy.

Two lines in `AGENTS.md` are wrong. The gate list names two site smokes, and the repository has five. The guide refers to `skill://commit`, and the skill has the name `commit-policy`. Work outgrew both lines, and the gate stayed green.

The most useful practice has no written form. In the player-facing identity slice, each design decision that came from a spike was correct. Each decision without a spike was wrong.

Spikes measured these facts about the game:

- A reader-facing race is the topmost record in a chain that resolves one name. `race_karu-elf_male` authors the name that its parent also authors.
- `CharacterData.CharName` generates a name from the race. The accessor then writes that name into the definition.
- The record table holds 320 character records. The game authors 298 of them, and creates 22 at run time.
- Six authored records share one `RecordID`.
- The build holds 27 loadable cell scenes. Three plan documents claimed 683 cells.

Work without a spike produced three wrong claims in the same slice. One claim reported a missing name vocabulary. The probe read `variant.nameSets`, and the published field has the name `variant.nameSetRefs`.

Our own artefacts produced three more errors. A window of `registry.ts` showed the `npc` entry without a read-model phase, and the diff showed that the phase was present. A query read a field name that does not exist, and the empty result became a defect report. Work extended the redirect mechanism, wired it through the CLI, and covered it with tests. The mechanism had never written a row, because the emitter filtered a source type that no code produces.

`openspec/config.yaml` tells a reader to ground each claim in the decompiled source, and to confirm each shape with a live export. Nothing makes that instruction operational. The repository has no spike workflow, no home for probes, and no rule for a negative result.

`docs/` holds the fourth home. Ten active plans, one roadmap of 76 kilobytes, one index, and 37 archived plans track status, findings, and counts. Specs, changes, tests, and emitted artifacts own each of those facts. A plan document therefore drifts from its owner, as "683 cells" drifted through three of them.

## What Changes

- Give each kind of statement one home. `.omp/RULES.md` holds hard requirements about this repository. `AGENTS.md` holds orientation, commands, and the definition of verified work. `openspec/config.yaml` holds planning-time artifact rules and a pointer to `AGENTS.md`.
- Move working style to the user-level rules, because those requirements apply to every repository. The user-level rules then state five requirements. Take the complete fix. Record a change when the complete fix cannot land. Fix or record an adjacent defect of the same class. Treat a report from another agent as a claim. Measure a behaviour claim before you use it.
- Make the spike practice operational in `skill://live-extraction`. A spike states one question, runs a probe, and records the measurement. A negative result needs a positive control.
- Hold a claim about this repository to the same standard as a claim about the game. A comment, a document, a test name, and code that exists describe intent. None of them shows what runs.
- Observe the output of an existing mechanism before you extend the mechanism.
- Add an export preflight that fails when more than one instrumented game holds the HotRepl port. During the identity slice, a stale instance answered an export.
- Add rules that match the tool arguments of a named anti-pattern. Three rules interrupt. The other rules report.
- Replace review with tests where a test can compare a written claim against the thing that the claim describes.
- Retire `docs/`. Ten active plans, one roadmap, one index, and 37 archived plans form a second planning system. Each fact in them has an owner already: a spec, a change, a test, a skill, or an emitted artifact. Move each surviving fact to its owner, then delete the directory. Git history keeps the record.
- Convert each planned slice into a change with unstarted tasks, and each open finding into a test or a change.

This change adds no reader-facing behaviour. No entity descriptor, public route, or relationship predicate changes. The change adds three tests, five rules, and one controller preflight.

## Capabilities

### New Capabilities

- `agent-instructions`: the home of each kind of instruction, the tests that enforce them, and the treatment of a stale or duplicated instruction.
- `evidence-standard`: the evidence that a behaviour claim needs, the spike that produces it, and the preflight that keeps an export honest.

### Modified Capabilities

None. The current specs describe published compendium behaviour, and this change does not alter that behaviour.
