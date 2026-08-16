## Context

See proposal.md for motivation. Four mechanisms are available, and they differ in ways that decide where each instruction goes. The facts below come from `omp://context-files.md` and `omp://rulebook-matching-pipeline.md`.

- A context file such as `AGENTS.md` is injected once, in the opening project prompt.
- `.omp/RULES.md` is loaded as an always-apply rule and re-attached near the current turn, so it survives a long conversation.
- A rule under `.omp/rules/` with a `condition` regex or an `astCondition` matches assistant text and tool arguments as they stream. It can abort the stream and re-inject itself, or with `interruptMode: never` fold a `<system-reminder>` into the matched tool call's result. `globs` acts as a path gate. AST conditions evaluate on edit and write arguments, per file, with language inferred from the path.
- Always-apply rules are deduped against loaded context-file bodies: a rule whose normalized content already appears in a context file is omitted from injection.

The repository currently has nine sticky rules, a 68-line `AGENTS.md`, three subsystem guides of 27, 30 and 37 lines, and an `openspec/config.yaml` carrying a context block plus per-artifact rules. Measured duplication: `entity.json` as sole source of truth and fail-fast appear in both `.omp/RULES.md` and `openspec/config.yaml`; clean cutover appears in `AGENTS.md` and `openspec/config.yaml`.

## Goals / Non-Goals

**Goals:**

- Place each instruction by the mechanism its job needs, so position matches purpose.
- Convert the parts of the standing direction that change a decision into written, checkable statements, and drop the parts that cannot be verified.
- Make the spike practice operational, with a home for probes and a ledger for measurements.
- Replace review with tests wherever a written claim can be compared against the thing it describes.

**Non-Goals:**

- Rewriting the guides. Measurement says they are lean and current; the defects are duplication and two decayed lines.
- Migrating the 37 archived plans into OpenSpec. They are history and reading them costs nothing.
- Adding a rule for every anti-pattern imaginable. Only patterns that have already cost a cycle here are encoded.

## Decisions

### 1. Repository facts are sticky; working style is user-level

`.omp/RULES.md` keeps requirements about this repository, because it is re-attached near the current turn and repository requirements must survive a long session. Working style that would apply to any repository moves to the user-level rules, where it is not confused with a fact about Ardenfall. This also keeps the repository file short enough to stay readable, which is the condition for it staying true.

### 2. `openspec/config.yaml` thins to planning rules plus a pointer

Its context block currently restates repository requirements that `.omp/RULES.md` already carries. Duplication drifts, and the dedupe rule can silently remove the sticky copy. The block keeps only what is specific to producing planning artifacts, and points at `AGENTS.md` for the rest. Context files load automatically, so a planning agent loses nothing.

Alternative considered: keep `config.yaml` self-contained so a planning agent needs nothing else. Rejected because it guarantees two copies of every requirement, which is what this change exists to remove.

### 3. Anti-pattern rules interrupt only when continuing is expensive

Three interrupt: a commit with `--no-verify`, a test or smoke that asserts on source text, and a `NOT NULL DEFAULT` column in pipeline SQL. Each of those, in the identity slice, either disabled a guard or produced work that had to be redone. Everything else reports without interrupting, in the shape that already works: the builtin `ts-set-map` rule folded a reminder into a write during this slice and changed the outcome without stopping it.

Precision is the constraint. Patterns are anchored to paths so that `--no-verify` matches a commit rather than prose about it, and a source-text pattern matches a read of a component from within a test or smoke rather than any file read. A rule that fires on good work is worse than no rule, because it trains the reader to dismiss the mechanism.

### 4. Spikes are disposable; measurements are durable

A probe is written against one game build and stops compiling against the next, so committing it invites rot and false authority. It lives in a gitignored `spikes/` directory during work. What survives is the measurement, in the ledger under `docs/plans/`, with its date and build, because that is what a later reader needs and what a later spike can contradict.

The positive-control requirement comes from a real failure in this slice: an empty probe result was reported as a missing-vocabulary defect when the probe was reading a field name that did not exist.

### 5. One evidence rule covers the game and ourselves

A claim about the game and a claim about our own pipeline fail the same way: an artefact that describes behaviour is read as if it established behaviour. Splitting them into two capabilities would put one rule in two homes, which is the defect this change exists to remove, so `evidence-standard` covers both and names the artefacts that are hypotheses: comments, documents, test names, variable names, plans, prior agent reports, and code whose existence is mistaken for proof that it runs.

The operational half is the mechanism check. Before extending a stage, table or projection, its output is observed in a built artifact. That single step would have caught the redirect emitter that never wrote a row, and the map layer that was declared while empty, which is now a pipeline diagnostic rather than a silence.

### 6. Written commands are compared against the commands they name

Three tests replace reading: the gate list against the package scripts, every `skill://` reference against the discovered skills, and every requirement sentence against the other homes. This follows the repository's existing habit of asserting that documentation matches behaviour, as `tooling.test.ts` already does for the release-artifact deploy contract.

The duplication test compares normalized sentences rather than whole files, since paraphrase is how the current duplication survived. It will not catch a rewritten paraphrase; a reviewer still can.

### 7. The export proves its own provenance

A preflight fails when more than one process holds the HotRepl port. The port is documented as first-come, and two instrumented games do not report a conflict, so the only way to keep an export honest is to refuse the ambiguous case rather than to remember the rule.

## Risks / Trade-offs

- **A rule that fires on acceptable work.** Mitigated by anchoring every pattern to a path and by keeping the set to five. If one proves noisy, it is deleted rather than downgraded, because a rule nobody trusts costs budget for nothing.
- **The duplication test entrenches wording.** Rewording a requirement in one home will make the test pass while the requirement is stated twice in different words. The test catches copies, not paraphrases; the boundary is stated in its failure message so a reader knows what it does not prove.
- **`spikes/` invites accumulation.** A gitignored directory grows unread. Accepted, because the alternative is committing version-specific probes, and the ledger is where the durable result already lives.
- **Working style in user-level rules is invisible to other contributors.** A collaborator cloning the repository sees the repository rules and not the working style. Accepted for this repository, which has one contributor; it would need revisiting with a second.
- **Fewer written aspirations may read as lower standards.** The opposite is intended: a statement nobody can check is not a standard, it is a mood, and it displaces statements that can be checked.
