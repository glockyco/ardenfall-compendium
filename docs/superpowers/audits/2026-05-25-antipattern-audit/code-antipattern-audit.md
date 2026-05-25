# Code Antipattern Audit — 2026-05-25

Scope: read-only review of `mod/src`, `controller/src`, `pipeline/src`, `site/src`, scripts, tests, package config, CI, and AGENTS guidance. This audit intentionally looks beyond the recent fallback cleanup work.

## Findings

### 1. Tag references still guess IDs from runtime names

- **Severity:** High
- **Paths:** `mod/src/Entities/Item/Adapters/ExtractItem.cs:104-114`, `mod/src/Entities/ItemTag/ItemTagExtractor.cs:21-38`, `mod-tests/ItemTagExtractorTests.cs:38-53`
- **Evidence:** Item extraction builds tag refs with `BuiltLookupTable.Instance?.GetGuid(tag) ?? tag.name`. The tag entity extractor emits a fatal diagnostic when a tag has no GUID, but then sets `id = assetName` and yields a row. The test suite currently asserts that a missing-GUID tag produces a row with ID `Floating Tag`.
- **Risk:** This violates the repository invariant that stable IDs come from `BuiltLookupTable.GetGuid(asset)` and that IDs must not be guessed from names. It can create name-derived tag refs without a diagnostic on item rows, and the tag table can contain fatal-but-still-materialized guessed IDs. If a tag is renamed, relationships can drift or silently split.
- **Recommendation:** Make missing tag GUIDs fail the tag row/reference path cleanly: emit a fatal diagnostic and omit the tag ref/row, or carry a structured missing-ref diagnostic, but do not use `tag.name`/asset name as an ID. Update tests to assert rejection/diagnostic behavior rather than preserving guessed IDs.

### 2. Snapshot artifact contracts are duplicated manually across mod, controller, and pipeline

- **Severity:** High
- **Paths:** `mod/src/Control/Handlers/RunFinalizeCommand.cs:134-204`, `controller/src/validate-snapshot.ts:19-71`, `pipeline/src/stages/load-snapshot.ts:39-100`, `pipeline/src/stages/load-descriptors.ts:16-57`
- **Evidence:** `RunFinalizeCommand` writes a hard-coded set of entity files/count keys (`items.json`, `stat-types.json`, `item-categories.json`, `item-tags.json`, plus special artifacts). The controller has its own `ENTITY_FILES` map for the same entity-to-file contract. The pipeline discovers entity descriptors from `entities/*/entity.json`, while `load-snapshot` loads every JSON envelope except a hard-coded exclusion list.
- **Risk:** Adding or renaming an entity requires synchronized edits in at least three layers. The controller validation can pass/fail based on its stale hard-coded list rather than the descriptor registry. This undermines the “filesystem is the registry” invariant and creates an export-pause failure mode when a newly emitted entity is not validated or when the controller rejects a valid future descriptor-backed artifact.
- **Recommendation:** Promote the descriptor registry or a generated artifact contract to the shared source of truth for entity IDs, snapshot file names, and required counts. At minimum, add a check that controller `ENTITY_FILES`, mod finalize output, and `entities/*/entity.json` remain isomorphic.

### 3. Batch chunk writes are not atomic, yet completion is recorded immediately afterward

- **Severity:** High
- **Paths:** `mod/src/Control/Handlers/EntityExportBatchCommand.cs:67-75`, `mod/src/Control/Handlers/RunFinalizeCommand.cs:284-324`, `mod/AGENTS.md:10-11`
- **Evidence:** `EntityExportBatchCommand` writes each chunk directly with `File.WriteAllText(path, json)` and then marks the chunk complete in `run.json`. The subsystem rule says extraction output is atomic and should write staging then rename. Finalize only checks `plan.IsComplete(offset)` and `File.Exists(ChunkPath(...))` before parsing and counting rows.
- **Risk:** A crash, cancellation, disk error, or process kill can leave a truncated chunk or a chunk that exists while run state says complete. Finalize will catch invalid JSON/row counts, but only at the end of an export, after expensive live-game work; worse, direct overwrite of a retrying chunk can briefly expose partial bytes to any reader.
- **Recommendation:** Write chunks to a same-directory temp file, fsync if practical, then atomic rename/replace before marking the plan complete. Treat run-state completion as derived from successful durable write, not as a separate source of truth.

### 4. Production-safe artifact deployment has a legacy bypass still exposed as a package script

- **Severity:** High
- **Paths:** `site/package.json:25-38`, `site/scripts/sync-generated-artifacts.mjs:41-66`, `site/scripts/stage-artifact.mjs:16-67`, `AGENTS.md:29-30`, `site/AGENTS.md:27-31`
- **Evidence:** `deploy:production` correctly stages a release artifact through `artifact-manifest.json`, validates hashes/counts/source kind, and rejects fixture artifacts. However, `site/package.json` still exposes `sync:generated`, whose script copies `pipeline/dist/data.sqlite` and `pipeline/dist/assets` into `site/static` after only non-empty-file checks; it does not require or validate `artifact-manifest.json`, artifact kind, live-game source, fatal diagnostics, SQLite metadata, or counts.
- **Risk:** Operators or automation can bypass the release/fixture separation and stage a debug `pipeline:run` output into the deployable static cache. This is an operational hazard precisely because it looks like an official package command.
- **Recommendation:** Remove `sync:generated`, or make it private/test-only and route it through the same manifest validation as `stage-artifact`. If it must remain for local demos, name it accordingly and hard-fail when `mode=release` semantics are not satisfied.

### 5. Generated validators can be stale without CI detecting the committed diff

- **Severity:** Medium-High
- **Paths:** `pipeline/scripts/codegen-validators.ts:8-70`, `pipeline/src/stages/load-snapshot.ts:3-7`, `.github/workflows/ci.yml:48-75`, `package.json:20-24`, `.gitignore:54-58`
- **Evidence:** Runtime code imports committed generated validator modules from `pipeline/dist/validate-*.mjs`. CI pipeline/site jobs run `bun run codegen:validators` before typecheck/tests, but there is no observed `git diff --exit-code` or equivalent check that regenerated files match what is committed. Release/fixture package scripts invoke `pipeline/src/cli.ts` directly; they do not run codegen first.
- **Risk:** A schema change can pass CI because CI regenerates validators in the workspace, while the committed branch remains stale. A local release artifact build or deploy from a clean checkout can then use old validator logic. This is a generated-artifact source-of-truth split.
- **Recommendation:** Add a generated-artifact freshness check after codegen in CI and pre-commit, and/or stop committing validators by generating them as part of package build/startup. Ensure `artifact:fixture` and `artifact:release` either depend on fresh validators or refuse to run when generated outputs are stale.

### 6. Item/category association still falls back from stable category refs to display names in pipeline and site queries

- **Severity:** Medium
- **Paths:** `mod/src/Entities/Item/Adapters/ExtractItem.cs:78-92`, `pipeline/src/stages/emit-read-models.ts:558-566`, `site/src/lib/server/read-models.ts:503-513`
- **Evidence:** The mod emits both `categoryRef` and `categoryName`. Pipeline item-category counts match items where `json_extract(i."categoryRef", '$.guid') = c.id OR i."categoryName" = c.category_name`. Site category item listing repeats the same `OR i."categoryName" = c.name` join.
- **Risk:** Category display names become a second relationship source of truth. A missing category GUID can still produce plausible counts/listings by name, masking source data breakage. If two categories share a name, or a name changes, category pages can over-count or mis-associate items.
- **Recommendation:** Treat `categoryName` as presentation/provenance only. Use `categoryRef.guid` for relationships. If legacy snapshots need migration, confine name matching to an explicit, diagnosed compatibility stage with tests proving it cannot ship silently.

### 7. Slug generation has a catch-all hash fallback with no diagnostic

- **Severity:** Medium
- **Paths:** `pipeline/src/stages/emit-read-models.ts:686-699`, `pipeline/src/relationships/relationship-graph.ts:105-157`
- **Evidence:** `deriveEntityNodeSlug` catches any error from `deriveSlug`/`deriveShortId`, hashes the entity ID, and emits a fallback slug. Existing relationship graph audits check missing targets and duplicate short IDs, but the fallback itself is not recorded in `pipeline_diagnostics`.
- **Risk:** Bad IDs or malformed labels can silently become public routes rather than failing or creating a diagnostic trail. This degrades permalink quality and makes route instability hard to trace after the artifact is built.
- **Recommendation:** Make slug fallback observable at minimum: insert a pipeline diagnostic with source, entity type/id, original error, and generated route. For public entities, consider failing instead of falling back unless the descriptor explicitly allows a compatibility slug.

### 8. Site read-model access has N+1 query behavior on item overviews

- **Severity:** Medium
- **Paths:** `site/src/lib/server/read-models.ts:486-501`, `site/src/lib/server/read-models.ts:548-575`
- **Evidence:** `listItemsOverview()` selects all overview rows and maps each through `toItemOverviewRow`; `toItemOverviewRow` calls `getItemPresentation(row.id)`, which performs a separate SQLite query and multiple JSON parses per item. `listItemsByVariant()` calls `listItemsOverview().filter(...)`, so a variant page loads and parses every item tooltip before filtering.
- **Risk:** Static prerender hides this from users but increases build time and memory as content grows. It also couples overview pages to full tooltip JSON even when the page may not need it. Large live exports can turn an otherwise linear query into hundreds/thousands of SQLite round trips and JSON parses.
- **Recommendation:** Query only needed fields for overview routes, use a single join/batch query for tooltip payloads where tooltips are required, and make variant/category/tag queries filter in SQL before hydration.

### 9. Tests pin orchestration text and script strings instead of behavior

- **Severity:** Medium
- **Paths:** `tooling.test.ts:110-136`, `tooling.test.ts:178-193`, `tooling.test.ts:195-215`, `controller/test/export-orchestrator.test.ts:100-120`, `controller/test/hotrepl-client.test.ts:272-276`
- **Evidence:** Tooling tests assert exact CI/package script strings and literal command snippets. Controller tests use fake clients heavily; one HotRepl retry test uses a fixed port (`18591`) and `setTimeout` to start a server.
- **Risk:** Exact-string tests are brittle during harmless refactors, but can still miss semantic regressions if a command string changes in an equivalent way or if behavior moves behind another script. Fixed ports/timers can introduce flakes under concurrent test runs.
- **Recommendation:** Keep a small number of guardrail string tests for truly load-bearing commands, but cover behavior through exported functions (`stageArtifact`, deploy command builder, pipeline command builder). Allocate ephemeral ports and deterministic test clocks where possible.

### 10. Export orchestration has sparse observability for long-running phases

- **Severity:** Medium
- **Paths:** `controller/src/export-orchestrator.ts:78-148`, `controller/src/export-orchestrator.ts:185-195`, `controller/src/wait-for-world.ts:16-40`
- **Evidence:** Export logs phase completion and per-batch offset completion, but `waitForJob` polls every 250 ms without surfacing job progress, elapsed time, or last status. `waitForWorld` tracks only a final `lastReason` for timeout. `quitGame` failures are logged but do not affect export result.
- **Risk:** When export pauses or stalls, operators have little evidence about whether the game, HotRepl, controller, or pipeline is blocked. This increases incident/debug time and can hide repeated cleanup failures after otherwise successful exports.
- **Recommendation:** Emit structured progress events for job status changes, elapsed durations, retry counts, final artifact paths/hashes, and cleanup failures. Keep `game.quit` non-fatal if that is intentional, but include it in the returned result so callers can alert.

### 11. `pipeline:run`/debug outputs can retain stale assets

- **Severity:** Medium
- **Paths:** `pipeline/src/cli.ts:51-59`, `pipeline/src/stages/emit-assets.ts:37-75`, `package.json:22-24`, `site/scripts/sync-generated-artifacts.mjs:48-66`
- **Evidence:** Artifact builds (`build-fixture`, `build-release`) remove `outDir` before running. Plain `run <snapshotDir> <outDir>` does not. `emitAssets` creates `outDir/assets` and writes missing WebPs but does not prune files that are no longer referenced. `syncGeneratedArtifacts` copies every `.webp` present in `pipeline/dist/assets`.
- **Risk:** Debug exports can accumulate stale assets. If the legacy sync path is used, unreferenced files can be staged and potentially deployed. This is not a data integrity bug for manifest-backed release artifacts, but it is an operational footgun for the exposed debug path.
- **Recommendation:** Either prune `assets` for `pipeline:run` or make `syncGeneratedArtifacts` refuse non-manifested output. Prefer routing all site staging through artifact manifests.

### 12. Site color parsing silently degrades malformed generated data

- **Severity:** Low-Medium
- **Paths:** `site/src/lib/server/read-models.ts:21-37`, `site/src/lib/server/read-models.ts:645-731`
- **Evidence:** `colorCss` catches JSON parse errors and returns `null`; it also returns `null` when `r/g/b` are not numbers. Consumers then render without icon/category color. Pipeline/staging validates row counts and artifact hashes, but this site-side parser does not surface malformed color JSON.
- **Risk:** A malformed generated color silently changes presentation. Because the site reads generated contracts, malformed JSON should be a pipeline/staging failure or visible diagnostic, not an invisible visual degradation.
- **Recommendation:** Validate color JSON in the pipeline before emitting read models, or make site loading fail with a contextual error for malformed generated fields. If graceful rendering is desired, record a pipeline diagnostic and expose it in artifact metadata.

## Suspicions needing more evidence

- **Potential stale committed generated outputs:** `find` shows ignored generated artifacts under `site/static`, `pipeline/artifacts`, and `pipeline/dist`; `.gitignore` appears to exclude deploy caches and artifacts. I did not inspect git index state, so this is only a suspicion unless `git status --ignored` confirms generated files are tracked unexpectedly.
- **Potential route ambiguity from whitespace or non-normalized IDs:** `mod-tests/ItemTagExtractorTests.cs:73-91` explicitly preserves a whitespace GUID. This may be a defensive parity choice, but if such IDs can reach public routes/SQLite keys, they need route/slug coverage. Evidence missing: a live BuiltLookupTable sample with whitespace GUIDs or a pipeline invariant proving they cannot be public.
- **Potential hidden coupling in route loaders:** The site has multiple entity route loaders with similar overview/detail patterns. I did not fully audit all Svelte route files, so duplication/abstraction recommendations should wait for a route-focused pass.

## Healthy patterns worth preserving

- **Fail-fast descriptor loading:** `pipeline/src/stages/load-descriptors.ts` derives entities from `entities/*/entity.json`, validates schemas, and checks folder/id consistency. This is the right source-of-truth direction.
- **Manifest-backed release staging:** `site/scripts/stage-artifact.mjs` validates artifact manifests, source kind, fatal diagnostics, SQLite counts, hashes, asset tree hash, and artifact metadata before staging.
- **Atomic SQLite emission:** `pipeline/src/stages/emit-sqlite.ts` writes SQLite to a temp path and renames, avoiding partial `data.sqlite` reads.
- **Relationship graph diagnostics:** `pipeline/src/relationships/relationship-graph.ts` centralizes public entity nodes, unique slug/short-id constraints, relationship edges, and diagnostic insertion.
- **Clean command catalog validation:** `controller/src/export-orchestrator.ts` checks required HotRepl command presence, kind, and version before export work begins.
- **Generated deploy cache ignored:** `.gitignore` excludes `site/static/data.sqlite`, `site/static/_release.json`, `site/static/assets/`, `pipeline/artifacts/`, and most generated `pipeline/dist` outputs while explicitly allowing validator modules.
