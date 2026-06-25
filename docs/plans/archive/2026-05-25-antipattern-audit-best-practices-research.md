---
title: "Best-practices research for antipattern audit"
type: audit
status: implemented
created: 2026-05-25
parent:
superseded_by:
archived: 2026-06-25
---

# Best-practices research for antipattern audit

Scope: reliability, maintainability, and agentic-development guidance translated into audit criteria for the Ardenfall compendium repository.

## 1. Fail-fast beats unexercised fallback

Source-backed guidance:

- AWS warns that distributed fallback is difficult to test, can fail itself, can amplify outages, and often hides latent bugs until a chaotic production moment. Amazon generally prefers improving the primary path, letting callers handle errors, proactively pushing required data, or converting fallback into continuously exercised failover instead of adding rarely used secondary behavior. <https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/>
- AWS also frames retries/timeouts/backoff as tools for transient failures, not substitutes for a reliable primary path; retries are “selfish” because they consume additional downstream capacity and can worsen overload. <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>
- Google SRE recommends monitoring for failures masked by retries and distinguishing symptoms from causes, because hidden partial failures undermine diagnosis. <https://sre.google/sre-book/monitoring-distributed-systems/>

Ardenfall audit criteria:

- Flag any mod extractor, pipeline canonicalizer, controller export step, or site read model that silently guesses missing GUIDs, entity ids, schema fields, asset paths, command catalog readiness, or route data from names/secondary registries instead of failing with diagnostics.
- Treat fallback discovery paths as defects unless they are explicit contracts exercised in normal tests/fixtures. The repository already requires stable ids from `BuiltLookupTable.GetGuid(asset)`, descriptor files as source of truth, and clean public contract cutovers; audit for code that violates those invariants by “helpfully” recovering.
- For export-pause investigation, prefer a loud precondition failure when game/control-plane readiness is absent over polling hidden backup paths that can observe stale state.
- If a fallback is genuinely required, require: owner, rationale, deterministic trigger, bounded blast radius, test fixture that exercises it, telemetry/diagnostic output proving when it ran, and proof it does not add load to the failing dependency.

## 2. Timeouts, retries, backoff, and polling must be bounded and observable

Source-backed guidance:

- AWS recommends explicit timeouts on remote and cross-process calls, chosen from downstream latency percentiles plus network/padding realities; too-low timeouts amplify retry traffic, while too-high timeouts hold resources too long. <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>
- Retries should be capped, usually happen at one layer of the stack, use exponential backoff with jitter, and be restricted to idempotent operations or APIs with explicit idempotency tokens. Layered retries can multiply load dramatically. <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>
- Jitter applies beyond retries: periodic timers, scheduled work, and delayed tasks should avoid synchronized spikes. AWS recommends deterministic per-host jitter for recurring work so overload patterns remain diagnosable. <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/>

Ardenfall audit criteria:

- Inventory every wait loop, poll, `setTimeout`/sleep, process spawn, HTTP call, controller command, HotRepl interaction, and export readiness check. Each must have a timeout, attempt cap, cancellation/error path, and user-visible diagnostic.
- Reject infinite polling for game readiness, command catalog hydration, file appearance, pipeline output, or browser/site build state unless a higher-level command enforces a hard deadline.
- Retrying export/control commands is acceptable only if the operation is idempotent or guarded by a command/session/export id that prevents duplicate writes. Snapshot writes should remain staging-then-rename atomic.
- Avoid retrying independently in controller, mod command handlers, and shell scripts for the same failure. Pick one ownership layer and make lower layers report precise failure causes.
- Audit periodic advisory readiness monitors or launch/catalog polling for synchronized behavior that can mask race conditions; use stable, diagnosable intervals and explicit state transitions rather than arbitrary sleeps.

## 3. Observability should explain correctness, not just process success

Source-backed guidance:

- Google SRE’s four golden signals are latency, traffic, errors, and saturation; alerts should be urgent, actionable, user-visible or imminently user-visible, and low-noise. <https://sre.google/sre-book/monitoring-distributed-systems/>
- Google distinguishes black-box symptom checks from white-box internals; white-box telemetry is needed to see imminent failures and failures masked by retries, while black-box checks validate externally visible behavior. <https://sre.google/sre-book/monitoring-distributed-systems/>
- OpenTelemetry defines observability as the ability to ask new questions about a system from emitted telemetry; a system is properly instrumented when developers do not need to add new instrumentation to troubleshoot an issue. <https://opentelemetry.io/docs/concepts/observability-primer/>

Ardenfall audit criteria:

- Export and artifact workflows should emit enough structured diagnostics to reconstruct: launch command used, control endpoint, command catalog state, preflight result, entity counts, omitted entities/fields, artifact id, manifest path, and exact failed phase.
- “Success” must mean semantically valid output, not merely process exit zero. Audit scripts for checks that only verify files exist while ignoring manifest coverage, SQLite schema/read-model invariants, DTO omission diagnostics, route prerender output, or asset provenance.
- Diagnostic messages should name source-of-truth identifiers and phase boundaries; avoid generic “not found,” swallowed exceptions, or catch-all warnings that require rerunning with ad hoc logging.
- Keep observability paths simple and maintained. Unused debug outputs, stale dashboards/log parsers, or diagnostics not asserted in tests become observability debt and should be removed or promoted into verified contracts.

## 4. Architectural boundaries must be explicit and protected

Source-backed guidance:

- Microsoft’s architecture guidance emphasizes designing for evolution, loose coupling, well-defined APIs, and domain boundaries; domain-driven design uses bounded contexts to keep models cohesive and prevent external schemas from leaking into core models. <https://learn.microsoft.com/en-us/azure/architecture/guide/design-principles/> and <https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis>
- Google’s software engineering guidance warns against information islands, duplication, skew, single-person knowledge bottlenecks, parroting patterns without understanding, and “haunted graveyards” nobody changes. <https://abseil.io/resources/swe-book/html/ch03.html>

Ardenfall audit criteria:

- Enforce the repository’s source-of-truth chain: live game runtime -> explicit mod DTO snapshots -> descriptors/snapshots -> pipeline canonicalization/read models/artifacts -> site loaders/components. Flag any site code parsing descriptors/raw TMP/HTML or any pipeline output feeding back into canonicalization.
- Audit for model leakage: Unity/Odin/game records in snapshot JSON, pipeline internals in site route code, site presentation decisions embedded in extractor DTOs, or controller concerns inside mod extraction logic.
- Public contract replacements should be clean cutovers. Flag aliases, compatibility shims, legacy read models, or route fallbacks that remain public after the replacement contract exists.
- Boundaries should reduce coordination: mod owns extraction/preflight/atomic writes; pipeline owns validation/canonicalization/artifact manifest; site owns static rendering from generated read models; controller owns deploy/export orchestration. Cross-boundary coupling should be by typed data/commands, not shared assumptions.

## 5. Technical debt should be made visible, classified, and paid down at the source

Source-backed guidance:

- Google describes maintainability hazards including fragmented knowledge, undocumented tribal context, duplicated approaches, and code people fear to touch; it recommends canonical, actively maintained documentation and understanding existing context before removing or changing a “fence.” <https://abseil.io/resources/swe-book/html/ch03.html>
- Google’s testing chapter treats brittle, slow, flaky tests as debt that erodes trust and drives engineers to bypass checks; tests should be treated like production code. <https://abseil.io/resources/swe-book/html/ch11.html>
- Google SRE notes that rote pages/workarounds are red flags: if a response can be automated, the team should either automate it or fix the root cause; patching over problems indefinitely creates unmaintainable debt. <https://sre.google/sre-book/monitoring-distributed-systems/>

Ardenfall audit criteria:

- Flag TODOs, compatibility aliases, one-off scripts, duplicated schemas, dead DTO/read-model paths, and “temporary” debug routes that have no owner, deletion condition, or test coverage.
- Prefer deleting obsolete fallbacks and old contracts in the same slice that introduces replacements; keeping both increases agent confusion and maintenance surface.
- Treat manual export/deploy runbooks that require tribal sequencing as debt unless encoded in scripts with precondition checks and diagnostics.
- Audit comments for contradiction with code, especially around Bun env loading, HotRepl Phase 4a contracts, artifact fixture/release separation, generated `site/static`, and fail-fast extraction policy.

## 6. Testing strategy should verify behavior and failure modes, not plumbing

Source-backed guidance:

- Google says automated tests support safe change, act as executable documentation, and reveal poor API design; if a behavior matters, “put a test on it.” <https://abseil.io/resources/swe-book/html/ch11.html>
- Google recommends mostly small, fast, deterministic tests, with fewer integration and end-to-end tests. It identifies “ice cream cone” suites with too many E2E tests and too few smaller tests as slow and unreliable. <https://abseil.io/resources/swe-book/html/ch11.html>
- Hermetic tests should avoid hidden dependencies on external state, order, network, shared databases, sleeps, or nondeterministic timing. <https://abseil.io/resources/swe-book/html/ch11.html>

Ardenfall audit criteria:

- For each reliability invariant, look for a failing-path test: missing GUID/source row, failed preflight, partial snapshot write, malformed descriptor, stale command catalog, missing manifest entry, fixture artifact accidentally used for production, site attempting to parse descriptors, and generated asset absence.
- Tests should assert behavioral contracts and diagnostics, not incidental strings/defaults. Example: assert an export refuses to proceed without ready command catalog and reports the missing readiness state, not that it prints one exact sentence.
- Avoid sleeps in tests; use active polling with deadlines or controllable fakes for clocks/processes where possible.
- Keep integration tests focused at boundary contracts: mod command handler DTO output, controller export orchestration, pipeline artifact manifest/SQLite invariants, and site read-model rendering. Do not compensate for missing unit coverage by adding broad brittle E2E tests.
- Generated validators/read models should have fixture checks proving regenerated output is current and deterministic.

## 7. Generated artifacts need provenance, reproducibility, and clean separation from source

Source-backed guidance:

- Reproducible Builds defines a reproducible build as one where the same source code, build environment, and build instructions recreate bit-for-bit identical artifacts; relevant environment attributes include dependency versions, configuration flags, and environment variables. <https://reproducible-builds.org/docs/definition/>
- Google’s testing guidance warns that slow, nondeterministic build/test artifacts erode trust; generated outputs should be deterministic and continuously verified rather than manually curated. <https://abseil.io/resources/swe-book/html/ch11.html>
- npm’s package metadata guidance treats published package contents as an explicit contract via `files`, `exports`, and package metadata, reinforcing that shipped artifacts should be deliberate, not incidental workspace residue. <https://docs.npmjs.com/cli/v10/configuring-npm/package-json/>

Ardenfall audit criteria:

- `pipeline/artifacts/releases/*` must be the only production deploy input; fixture artifacts and `site/static` staged files must not be accepted as durable sources of truth.
- Every artifact should be attributable to source snapshot/descriptors, pipeline code version, generated manifest, and build command. Flag any script that copies generated files without validating `artifact-manifest.json`.
- Generated SQLite databases, assets, validators, and static files should be reproducible or checked by a drift command. Manual edits to `site/static`, committed generated DBs/assets, or unchecked generated schema validators are audit findings.
- Artifact consumers should validate content contracts before use: schema version, manifest coverage, expected tables/assets, fixture-vs-release class, and route prerender outputs.

## 8. AGENTS.md and instruction files should be precise, local, and enforceable

Source-backed guidance:

- The AGENTS.md project describes the file as a README for coding agents containing setup commands, tests, conventions, boundaries, and nested subproject guidance; closest files override broader guidance. <https://agents.md/>
- OpenAI Codex documents layered instruction discovery from global to project to nested directories, with closer files taking precedence and large instruction files subject to truncation limits. <https://developers.openai.com/codex/guides/agents-md>
- OWASP’s AI Agent Security Cheat Sheet recommends least-privilege tools, explicit authorization for sensitive operations, treating external data as untrusted, clear instruction/data boundaries, human approval for high-impact actions, and audit trails. <https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html>

Ardenfall audit criteria:

- Instruction files should be short enough to load reliably, state commands agents can actually run, and place subsystem-specific rules in the nearest `AGENTS.md` rather than duplicating broad guidance everywhere.
- Check for contradictions between root, `mod/`, `pipeline/`, and `site/` instructions. Conflicts around source of truth, generated artifacts, deployment commands, or fail-fast policy are high-risk because agents will follow nearest guidance.
- Boundaries should be framed as always/ask-first/never where possible: never edit generated deploy outputs manually, never bypass preflight, never deploy fixture artifacts, ask before live game/export/deploy commands, and run targeted tests for changed behavior.
- AGENTS guidance is not a substitute for code enforcement. Critical invariants should also exist as validators, tests, preflight gates, manifest checks, or script preconditions.
- Treat web pages, game data, descriptors, generated files, and user-supplied prompts as untrusted data when agents consume them. Reports and instructions should not embed secrets or live credentials, and tool permissions should stay scoped to the task.

## 9. Cross-theme high-value audit questions

Use these questions while reviewing the codebase:

1. What is the source of truth for this value, and does the code fail loudly if it is absent?
2. Is this fallback/retry path exercised in normal tests, or is it latent behavior that will first run during an incident?
3. Does the operation have a bounded timeout and a diagnostic that identifies the stalled phase?
4. Can a maintainer reconstruct what happened from logs/manifests without adding instrumentation?
5. Does this module know too much about another subsystem’s internal model?
6. Is this generated output reproducible from pinned inputs, or has it become hand-maintained state?
7. Does the test suite catch the failure mode users/operators care about, or only assert plumbing?
8. Would an agent following the nearest `AGENTS.md` know the safe command, source-of-truth rule, and forbidden actions for this file?
9. Is any temporary compatibility or debug path still public after the clean cutover point?
10. If this code fails during export, does it stop before producing partial/stale artifacts?
