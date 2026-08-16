## 1. One home per statement

- [ ] 1.1 Remove from `openspec/config.yaml` every requirement that `.omp/RULES.md` already states, leaving planning-time artifact rules and a pointer to `AGENTS.md`. Confirm the planning context still names the constraints an artifact author needs.
- [ ] 1.2 Move working-style requirements out of the repository files and into the user-level rules: prefer the complete fix and record rather than ship a compromise; fix or record an adjacent defect of the same class; fix the class rather than the instance; treat a subagent's report as a claim to re-measure; require a measurement for a behaviour claim; one subject per commit, green at every commit.
- [ ] 1.3 Trim `.omp/RULES.md` to hard requirements about this repository, and state at its head which home holds what, so the next reader places a new rule correctly.
- [ ] 1.4 Repair `AGENTS.md`: complete the gate list from the package scripts, and replace `skill://commit` with the skill that exists.

## 2. Written claims become tests

- [ ] 2.1 Add a test that the gate list in `AGENTS.md` names exactly the site smoke scripts and repository check scripts that `package.json` defines, failing with the missing or stale entry.
- [ ] 2.2 Add a test that every `skill://<name>` reference in the guidance files resolves to a discovered skill, failing with the reference and its file.
- [ ] 2.3 Add a test that no requirement sentence appears in two homes, comparing normalised sentences across `.omp/RULES.md`, `AGENTS.md` and `openspec/config.yaml`, and stating in its failure message that it catches copies rather than paraphrases.

## 3. Anti-patterns caught at the keystroke

- [ ] 3.1 Add an interrupting rule for a commit carrying `--no-verify`.
- [ ] 3.2 Add an interrupting rule for a test or smoke that reads a component, module or config file and asserts on its contents, scoped to test and smoke paths, and worded so a deliberate policy check on source can say so.
- [ ] 3.3 Add an interrupting rule for a `NOT NULL DEFAULT` column added under `pipeline/src/sql/`.
- [ ] 3.4 Add reporting rules for reintroducing a retired name, covering the legacy route table, the `previousRoutes` descriptor field and the `Unnamed character` placeholder.
- [ ] 3.5 Add a reporting rule for a probe or smoke that selects its subject by a fixture id or name rather than by the state under test.
- [ ] 3.6 Verify each rule fires on a sample that should trigger it and stays silent on a sample that should not, and delete any rule that cannot be made precise.

## 4. Spikes and their evidence

- [ ] 4.1 Extend `skill://live-extraction` with the spike practice: the question, the probe, the recorded measurement, and the positive control required for a negative result.
- [ ] 4.2 Add `spikes/` to `.gitignore` and say in the skill why a probe is not committed while its measurement is.
- [ ] 4.3 State in the skill that a measurement is retaken after extraction code changes, since the previous export cannot have exercised the new code.
- [ ] 4.4 Record in the evidence ledger the measurements this slice produced that are not yet written there, each with its date and game build.
- [ ] 4.5 State in the user-level rules that an artefact describing behaviour is a hypothesis: a comment, document, test name, plan, prior agent report, or code that merely exists. Establish behaviour from the line that does the work or from an observed result, and correct a contradicting artefact in the same commit.
- [ ] 4.6 State that an existing stage, table or projection is observed producing output in a built artifact before it is extended, and that one producing nothing is repaired or removed rather than extended.

## 5. Export provenance

- [ ] 5.1 Add a controller preflight that fails when more than one process holds the HotRepl port, naming the port and the processes, and covering it with a test.
- [ ] 5.2 Cover the reproducibility contract with a test over two exports from one session, asserting equal per-family counts, equal filtered runtime-created count, and equal artifact hashes except timing records.

## 6. Boundary between plans and specs

- [ ] 6.1 State in `AGENTS.md` that specs own what must be true, changes own what is in flight, and `docs/plans` owns audits, measurements and slice evidence.
- [ ] 6.2 Remove restated slice status from the roadmap, keeping its evidence sections, and note that status is read from the change tracker.

## 7. Verification

- [ ] 7.1 Run the full gate in `AGENTS.md`, which by then includes the three new tests.
- [ ] 7.2 Start a fresh session and confirm the sticky rules arrive, the anti-pattern rules are registered, and no rule is dropped as a duplicate of a context file.
- [ ] 7.3 Archive this change once the gate passes and the roadmap records its evidence.
