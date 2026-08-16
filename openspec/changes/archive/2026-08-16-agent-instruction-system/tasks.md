## 1. One home per statement

- [x] 1.1 Remove from `openspec/config.yaml` each requirement that `.omp/RULES.md` states.
- [x] 1.2 Keep the planning-time artifact rules in `openspec/config.yaml`, and add a pointer to `AGENTS.md`.
- [x] 1.3 Confirm that the planning context still names the constraints that an artifact author needs.
- [x] 1.4 Move the working-style requirements from the repository files to the user-level rules.
- [x] 1.5 State in the user-level rules: take the complete fix, whatever its size.
- [x] 1.6 State in the user-level rules: record a change when the complete fix cannot land, and ship no compromise.
- [x] 1.7 State in the user-level rules: fix or record an adjacent defect of the same class.
- [x] 1.8 State in the user-level rules: search for further instances before the commit.
- [x] 1.9 State in the user-level rules: treat a report from another agent as a claim, and measure it again.
- [x] 1.10 State in the user-level rules: one subject per commit, and a green tree at each commit.
- [x] 1.11 Trim `.omp/RULES.md` to hard requirements about this repository.
- [x] 1.12 Add one line at the head of `.omp/RULES.md` that names the home of each kind of statement.
- [x] 1.13 Complete the gate list in `AGENTS.md` from the scripts in `package.json`.
- [x] 1.14 Replace `skill://commit` in `AGENTS.md` with the skill that exists.

## 2. Tests for written claims

- [x] 2.1 Add a test that compares the gate list in `AGENTS.md` against the scripts in `package.json`.
- [x] 2.2 Fail that test with the name of the missing or stale entry.
- [x] 2.3 Add a test that resolves every `skill://<name>` reference in the guidance files.
- [x] 2.4 Fail that test with the reference and its file.
- [x] 2.5 Add a test that finds a requirement sentence in two homes.
- [x] 2.6 State in that failure message that the test catches copies and not paraphrases.

## 3. Rules for named anti-patterns

- [x] 3.1 Add an interrupting rule for a commit that carries `--no-verify`.
- [x] 3.2 Add an interrupting rule for a test or smoke that asserts on source text.
- [x] 3.3 Scope that rule to test and smoke paths.
- [x] 3.4 Word that rule so that a deliberate policy check on source can declare itself.
- [x] 3.5 Add an interrupting rule for a `NOT NULL DEFAULT` column under `pipeline/src/sql/`.
- [x] 3.6 Add a reporting rule for the legacy route table, the `previousRoutes` field, and the `Unnamed character` placeholder.
- [x] 3.7 Add a reporting rule for a probe or smoke that selects a subject by a fixture id or name.
- [x] 3.8 Run each rule against a sample that must trigger it, and against a sample that must not.
- [x] 3.9 Delete each rule that cannot reach that precision.

## 4. Spikes and evidence

- [x] 4.1 Add the spike practice to `skill://live-extraction`: one question, one probe, one recorded measurement.
- [x] 4.2 State in the skill that a negative result needs a positive control.
- [x] 4.3 Add `spikes/` to `.gitignore`.
- [x] 4.4 State in the skill that the repository holds no probe, and that each result goes to its owner.
- [x] 4.5 State in the skill that work repeats a measurement after extraction code changes.
- [x] 4.6 Confirm that each measurement from this slice reached its owner: the artifact, a spec sentence, or the archived change.
- [x] 4.7 State in the user-level rules that an artefact which describes behaviour is a hypothesis.
- [x] 4.8 State that a behaviour claim rests on the line that does the work, or on an observed result.
- [x] 4.9 State that the commit which finds a contradicting artefact corrects it.
- [x] 4.10 State that work observes the output of a mechanism in a built artifact before work extends it.

## 5. Export provenance

- [x] 5.1 Add a controller preflight that fails when more than one process holds the HotRepl port.
- [x] 5.2 Name the port and the processes in that failure.
- [x] 5.3 Cover the preflight with a test.
- [x] 5.4 Add a test for the reproducibility contract over two exports from one session.
- [x] 5.5 Assert equal family counts, an equal filtered runtime-created count, and equal artifact hashes.
- [x] 5.6 Permit a difference in the timing records only.

## 6. Verification

- [x] 6.1 Run the full gate in `AGENTS.md`, which then includes the three new tests.
- [x] 6.2 Start a new session, and confirm that the sticky rules and the five anti-pattern rules arrive. Rules load at session start, so this needs a restart. Each file parses, carries a description, and fires on its own control sample.
- [x] 6.3 Confirm that `omp` registers each anti-pattern rule. A test now fires each rule on the anti-pattern it describes and on clean code, so a dead regex fails the gate.
- [x] 6.4 Confirm that `omp` drops no rule as a duplicate of a context file. Deduplication applies to an always-apply rule, and each anti-pattern rule registers a condition, so all five sit in the trigger bucket. The duplicate-sentence test covers the narrative files.
- [x] 6.5 Archive this change after the gate passes.
