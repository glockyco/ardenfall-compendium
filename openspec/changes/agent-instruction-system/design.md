## Context

See proposal.md for the motivation. Four mechanisms exist, and their differences select the home of each instruction. `omp://context-files.md` and `omp://rulebook-matching-pipeline.md` state the facts below.

- A context file such as `AGENTS.md` enters the opening project prompt one time.
- `omp` loads `.omp/RULES.md` as an always-apply rule and attaches it near the current turn. Its content stays in force through a long session.
- A rule under `.omp/rules/` with a `condition` regex or an `astCondition` matches assistant text and tool arguments during the stream. The rule can abort the stream and inject itself again. With `interruptMode: never` the rule folds a `<system-reminder>` into the result of the matched tool call. A `globs` entry gates the match by path. An AST condition evaluates edit and write arguments for each file, and infers the language from the path.
- `omp` dedupes always-apply rules against the loaded context files. `omp` drops a rule when a context file already contains its content.

The repository holds nine sticky rules, a 68-line `AGENTS.md`, and subsystem guides of 27, 30, and 37 lines. `openspec/config.yaml` holds a context block and artifact rules. Measured duplication: `.omp/RULES.md` and `openspec/config.yaml` both state the `entity.json` rule and the fail-fast rule. `AGENTS.md` and `openspec/config.yaml` both state the clean-cutover rule.

## Goals / Non-Goals

**Goals:**

- Select the home of each instruction from the mechanism that its job needs.
- Write the parts of the standing direction that change a decision. Drop the parts that no reader can check.
- Make the spike practice operational. Give probes a home and measurements a ledger.
- Replace review with a test wherever a test can compare a written claim against the thing that the claim describes.

**Non-Goals:**

- A rewrite of the guides. The guides are short, and they contain no stale terms.
- A migration of the 37 archived plans into OpenSpec. Those plans are history.
- A rule for every possible anti-pattern. This change encodes the patterns that already cost a cycle here.

## Decisions

### 1. Repository facts stay sticky, and working style moves to the user level

`.omp/RULES.md` holds requirements about this repository. `omp` attaches the file near the current turn, and repository requirements must survive a long session. Working style applies to every repository, so it moves to the user-level rules. The move also keeps the repository file short. A short file stays true.

### 2. `openspec/config.yaml` keeps planning rules and a pointer

The context block currently repeats requirements from `.omp/RULES.md`. Two copies drift apart, and the dedupe rule can remove the sticky copy. The block keeps the rules that apply to planning artifacts. For every other requirement the block points to `AGENTS.md`. Context files load without a request, so a planning agent loses nothing.

The alternative keeps `config.yaml` complete on its own. That alternative guarantees two copies of every requirement, and this change exists to remove them.

### 3. Three rules interrupt, and the others report

Three anti-patterns interrupt: a commit with `--no-verify`, a test or smoke that asserts on source text, and a `NOT NULL DEFAULT` column in pipeline SQL. In the identity slice, each of the three disabled a guard or forced repeated work. Every other rule reports and continues. The builtin `ts-set-map` rule used that form during this slice. The reminder changed the outcome and did not stop the work.

Precision limits the set. Each pattern names a path, so `--no-verify` matches a commit and not prose about a commit. A source-text pattern matches a read of a component inside a test or a smoke, and not every file read. A rule that fires on correct work is worse than no rule, because the reader learns to dismiss the mechanism.

### 4. A measurement goes to its owner, and the repository keeps no ledger

A probe targets one game build, and the next build breaks it. A committed probe therefore decays and gains false authority. Each probe lives in a `spikes/` directory that git ignores.

A ledger of measurements looked attractive, and it fails the rule this change enforces. The pipeline already emits every count into `artifact-manifest.json` and every diagnostic total into `diagnostics.json`. A ledger would copy those values into prose, where they drift. Each result therefore goes to one owner. The artifact holds a count. The spec requirement holds the mechanism that justifies it, in one sentence. The archived change holds the probe and its output. A spec that states a count also needs a test, because a number inside prose rots as "683 cells" did.

The positive-control rule comes from a failure in this slice. An empty probe result became a report of a missing vocabulary. The probe read a field name that does not exist.

### 5. One evidence rule covers the game and this repository

A claim about the game and a claim about our pipeline fail in the same way. A reader treats an artefact that describes behaviour as proof of behaviour. Two capabilities for one rule place one rule in two homes, and this change removes such duplication. `evidence-standard` therefore covers both. The spec names each artefact that is a hypothesis. The list holds comments, documents, test names, variable names, plans, and reports from other agents. The list also holds code whose existence looks like proof.

The operational half is the mechanism check. Work observes the output of a stage, a table, or a projection in a built artifact before work extends it. That step catches a redirect emitter that never wrote a row. It also catches a declared map layer that stays empty, which the pipeline now reports.

### 6. A test compares each written command against the command it names

Three tests replace reading. The first compares the gate list against the package scripts. The second resolves every `skill://` reference. The third compares requirement sentences across the homes. The repository already tests such alignment. `tooling.test.ts` asserts the release-artifact deploy contract in the same way.

The duplication test compares normalised sentences and not whole files, because paraphrase hid the current duplication. The test does not catch a rewritten paraphrase. A reviewer catches that case.

### 7. The export proves its own provenance

A preflight fails when more than one process holds the HotRepl port. The port serves the process that binds first, and two instrumented games report no conflict. An export therefore refuses the ambiguous case. A written reminder cannot replace the refusal.

## Risks / Trade-offs

- **A rule fires on acceptable work.** Each pattern names a path, and the set holds five rules. A noisy rule leaves the set. A downgraded rule stays in the budget and earns no trust.
- **The duplication test entrenches wording.** A reworded requirement passes the test and still states one requirement twice. The test catches copies. The failure message states that limit, so a reader knows what the test does not prove.
- **The `spikes/` directory accumulates files.** An ignored directory grows and nobody reads it. The alternative commits probes that target one build. The ledger already holds the durable result.
- **Working style stays invisible to a collaborator.** A collaborator reads the repository rules and not the user-level rules. This repository has one contributor. A second contributor needs a different arrangement.
- **A shorter set of written aspirations can read as a lower standard.** The opposite holds. Nobody can check an unverifiable statement, and it takes the place of a statement that a reader can check.
