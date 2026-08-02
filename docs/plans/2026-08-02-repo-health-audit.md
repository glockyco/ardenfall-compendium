---
title: "Repository Health Audit — 2026-08-02"
type: audit
status: active
created: 2026-08-02
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Repository Health Audit — 2026-08-02

Scope: planning coherence, all four subsystems, schemas, tooling/CI, tests, dependency currency, and compliance with the nine invariants in `AGENTS.md`. Every finding below is verified against the tree at commit `caef3c1`.

Findings are ordered by consequence. Severity means: **critical** — ships wrong data or hides breakage repo-wide; **major** — real defect or invariant violation with a plausible failure path; **minor** — worth fixing, no current failure path.

---

## Critical

### C1. `bun run typecheck` typechecks zero files

`tsconfig.json` is `{ "extends": "./tsconfig.base.json", "include": [], "files": [] }` with no project references, and `package.json` defines `typecheck` as `bunx tsgo --noEmit -p .`. An empty `include` means the project contains no files.

Proven, not inferred: placing `export const broken: number = "definitely not a number";` in `pipeline/src/` leaves `bun run typecheck` exiting `0`. `tsgo --noEmit -p . --listFiles` matches zero files under `pipeline/src` or `controller/src`.

Pointing the compiler at the real projects surfaces what has been hidden:

| Project | Real type errors | Config errors (`TS5097`) |
| --- | --- | --- |
| `pipeline` (`src` 18, `test` 25) | 43 | 26 |
| `controller` | 4 | — |

The real errors are not cosmetic. `pipeline/src/entities/item/read-models.ts:295` passes `string | undefined` where `string` is required; `:298` assigns it; four canonicalisers (`item-category:22`, `item-tag:13`, `location:49`, `portal:18`) use `TS2352` casts the compiler rejects as non-overlapping; `pipeline/src/entities/registry.ts:24` has an invalid type predicate. Under `noUncheckedIndexedAccess` these are precisely the undefined-at-runtime cases the flag exists to catch.

The 26 `TS5097` errors are one missing option: the repo imports with explicit `.ts` extensions but `tsconfig.base.json` never sets `allowImportingTsExtensions`. That is almost certainly why the root config was emptied — the honest config never compiled, so it was silenced instead of fixed.

CI runs the same vacuous command at `.github/workflows/ci.yml:58`. `site` is unaffected: it is genuinely checked by `svelte-check` via `bun run --cwd site check`.

**Recommendation.** Add `allowImportingTsExtensions: true` (with `noEmit`) to `tsconfig.base.json`, convert the root `tsconfig.json` to project references over `pipeline`, `controller`, and `site`, then fix the 47 real errors. Until the backlog is cleared, run the per-project checks in CI so the number cannot grow. `pipeline/package.json` and `controller/package.json` already define a working `typecheck` script; nothing invokes them.

### C2. A fatally-rejected pipeline run leaves deployable artifacts behind, and an ungated script will stage them

Two defects compose into a path from rejected data to the deployable site.

`pipeline/src/cli.ts:67` runs `[loadDescriptors, loadSnapshot, validate, emitAssets, emitSqlite]` to completion, and only afterwards, at `:76-83`, checks `v.countsBySeverity.fatal > 0` and exits `1`. `emit-sqlite` has no dependency on the validate result, so `data.sqlite` and the asset tree are already written to `pipeline/dist/` before the run is rejected.

`site/scripts/sync-generated-artifacts.mjs:14` defaults its source to exactly that directory (`resolve(import.meta.dirname, "../../pipeline/dist")`) and copies `data.sqlite` plus the asset tree straight into `site/static`. It validates the manifest and hashes but performs **no** `artifactKind` or source-kind check — grep for `artifactKind|release|fixture|mode` in that file returns nothing. It is exposed as the `sync:generated` script in `site/package.json`.

The correct path already exists beside it: `site/scripts/stage-artifact.mjs:27-35` rejects a mismatched `artifactKind` and requires `source.kind === "live-game-export"` for release mode, and `deploy:production` uses it. So `sync:generated` is a surviving pre-cutover duplicate that bypasses the gate its replacement enforces — violating both the clean-cutover invariant and the release-artifact invariant.

**Recommendation.** Make `emit-sqlite` consume the validate output and fail before writing anything. Delete `sync-generated-artifacts.mjs` and the `sync:generated` script.

---

## Major

### M1. Fatal relationship-graph diagnostics gate nothing

`pipeline/src/entities/item/read-models.ts:399` inserts the diagnostics from `auditEntityGraph(db)`, and `pipeline/src/relationships/relationship-graph.ts:118-126` classifies a missing public edge target as **fatal**. Nothing reads that severity. `cli.ts:76` only inspects the snapshot validate stage. An artifact can therefore be produced and published carrying fatal graph diagnostics — broken cross-entity links ship silently.

### M2. The controller cannot tell which game it is driving

`controller/src/export-orchestrator.ts:86-92` verifies only that the peer exposes the required command *names*. There is no product-name or version handshake. This is not hypothetical: during this session's live export, another HotRepl-instrumented game (`Vespera` / `ancientkingdoms 0.9.27.0`) held the default port `18590`, and the controller connected to it. Only a manual `Application.productName` probe caught it. A peer exposing the same command surface would be driven to completion and produce a confidently wrong snapshot.

**Recommendation.** Add an identity assertion to `compendium.preflight` — expected product name and game version — and fail the export on mismatch.

### M3. `validate-snapshot.ts` cannot detect a semantically empty export

`controller/src/validate-snapshot.ts:28-73` checks manifest presence, hash integrity for listed files, that six entity files parse, that `rows` is an array, and that `fatal === 0`. A structurally perfect snapshot with **zero rows for every entity** passes and returns `itemCount: 0`. Given C2, that empty database is then writable into the site.

### M4. Descriptor `kind` conditionals are declared but not enforced

`schemas/entity.schema.json` declares `kind: definition|instance|role` at `:11`, and defines `definition.entity/via`, `placement`, `facetOf`, `predicate`, `placementVia` as independent optional properties at `:33-52`. The file contains exactly two `oneOf` occurrences (`:93` nullable `siteMap`, `:155`), neither related to `kind`. There is no `if`/`then`, `allOf`, or `dependentSchemas`.

So a `kind: "definition"` descriptor may carry `facetOf`; a `kind: "instance"` descriptor may omit its `definition` block entirely — which `entities/portal/entity.json` in fact does, contradicting the active spec (see P2). The `kind` field currently documents intent without constraining anything.

### M5. The `role` vocabulary is contract surface with no implementation

`facetOf`, `predicate`, and `placementVia` exist in `schemas/entity.schema.json:50-52` and `facetOf` is typed in `pipeline/src/types.ts:15-19`. No code in `pipeline/src`, `site/src`, or `mod/src` reads any of them. A `kind: "role"` descriptor would validate, load, and then be silently ignored by canonicalisation, read-model emission, and map projection — the exact silent-fallback failure the invariants forbid.

**Recommendation.** Either implement `role` in the slice that needs it (vendor, per the roadmap) or remove the vocabulary until then. Settle this **before** planning Slice 8, so NPCs are not designed against a contract that may not survive.

### M6. CI omits most of the documented gate

`AGENTS.md:20` defines the pre-yield gate. CI runs a strict subset:

| Gate | Local (documented) | CI |
| --- | --- | --- |
| `format:check`, `lint` | yes | `ci.yml:44-45` |
| `bun test pipeline/test` | yes | `ci.yml:59` |
| `check:validators` | yes | `ci.yml:57,70,99` |
| `artifact:fixture`, `site check`, `site build` | yes | `ci.yml:72-74` |
| `check:fixtures` | yes | `ci.yml:100` |
| `bun test site/test` | yes | **missing** |
| `bun test controller/test` | yes | **missing** |
| `dotnet test mod-tests/…` | yes | **missing** (only `dotnet format` at `:85`) |
| `smoke:prerender` | yes | **missing** |
| `git diff --check` | yes | **missing** |

**93 mod tests, 32 controller tests, and 20 site tests never run in CI.** Only the C# *formatter* runs. Combined with C1, CI's automated defence is markedly thinner than the documentation implies.

### M7. The "no raw game JSON" invariant is honoured by convention, not by types

No violation currently ships — every snapshot write is `JsonConvert.SerializeObject` over an explicit envelope (`mod/src/Emit/SnapshotWriter.cs:28`, `Control/Handlers/EntityExportBatchCommand.cs:71`), and there is no reflection dump or Odin `SerializationUtility` call anywhere.

But the type system permits one. `mod/src/Entities/Item/ItemSnapshot.cs:17` declares `Fields` as `Dictionary<string, object?>`, and the ref slots in `Adapters/ItemAdapterHelpers.cs:22-48,89` are `object?` / `List<object?>`. Any future adapter that drops a Unity or Odin object into those slots will be serialised without complaint. For the repo's single loudest invariant, that is weak enforcement.

### M8. Mod extractors diverge in diagnostic policy, and one truncates silently

`mod/src/Entities/Item/ItemExtractor.cs:40` does `yield break` when a lookup is null — no diagnostic, no fatal. The snapshot is silently truncated. At `:62-66` an unsupported subtype logs a diagnostic and omits the row, so an item disappears from the compendium with only an informational note.

Policy is inconsistent across extractors: item and portal treat missing identity as fatal; location treats a missing map id as a diagnostic; item-tag emits no row diagnostics and drains no refs; `ItemCategoryExtractor.cs:67` and the location volume source call `.Select` with no null guard, turning malformed source data into an unhandled exception rather than a diagnostic.

Additionally, the per-run caches (`_byRun` in each `mod/src/Extraction/*Service.cs`) are never evicted, and `CompendiumRunManager.cs:11` retains finalized runs unless explicitly discarded — unbounded growth plus stale Unity references across repeated exports in one game session.

### M9. Unbounded operations in the export controller

`export-orchestrator.ts:195-202` waits for a batch job with no timeout — a job that never completes hangs the export forever. `SdkControllerClient.describeCommands` (`sdk-control-client.ts:54-57`) discards the timeout the orchestrator passes and calls `listCommands()` bare. `startJob`/`jobStatus` (`:70-110`) have no timeouts. Meanwhile `CONNECT` and `FINALIZE` are both `300_000` with no stated rationale. On failure the `finally` block only attempts `game.quit`, whose errors are swallowed (`:181-192`); no `run.discard`, no job cancellation, no staging cleanup, so retries accumulate garbage under the snapshots directory.

### M10. Manual entity-id registries contradict "filesystem is the registry"

`pipeline/src/entities/registry.ts:3-22` hand-maintains `canonicalizerSupport`, `readModelSupport`, and `mapReadModelSupport` as literal maps of entity ids, while `stages/load-descriptors.ts:14-48` already discovers descriptors dynamically from disk. Entity-specific dispatch is hardcoded in three more places: `stages/emit-read-models.ts:49-57`, `map/read-models.ts:34-77`, and `stages/emit-site-metadata.ts:116-155`.

This is a genuine tension rather than a clear defect: the maps also serve as a compile-time coverage assertion via `validateDescriptorCoverage`, which is valuable. The problem is that they are *four* hand-edited lists, so adding an entity means finding all of them. **Recommendation:** keep the coverage assertion, but key emitters off a single descriptor-driven registry so there is one place to edit.

### M11. Documentation points at a directory that no longer exists

`docs/superpowers/` contains only `.DS_Store` and an empty `progress/`. It is still cited as the living roadmap in `README.md:109,132,135` and `AGENTS.md:3,7`. The real documents are `docs/plans/2026-04-29-ardenfall-compendium-roadmap.md` and `docs/plans/2026-06-04-compendium-data-architecture.md`. A new contributor following the README's orientation link lands nowhere. `docs/plans/2026-06-04-compendium-data-architecture.md:13` also extends a non-existent `docs/superpowers/specs/…` path, and the roadmap's HotRepl v3 entry (`:117`) cites an archived plan absent from `docs/plans/archive/`.

`CLAUDE.md` is healthy: a one-line delegation to `AGENTS.md`, not a divergent copy.

### M12. `.env.example` is missing `HOTREPL_PORT`

`HOTREPL_PORT` was added to the deploy path in commit `8ab8f02` and is read by `hotrepl:deploy`, but `.env.example` documents only `HOTREPL_URL="ws://127.0.0.1:18590"`. Every other consumed variable is documented. A fresh clone silently gets the default port — which is exactly the collision that caused M2.

---

## Minor

### N1. Dead surface

Adjudicated across the whole repo, not just the pipeline. Most tables initially suspected dead are in fact read by the site or by `stage-artifact.mjs`. Genuinely dead:

- `entity_disambiguations` — `CREATE TABLE` at `relationships/relationship-graph.ts:45-48`, never written, never read, 0 rows live. Its would-be writer `insertDisambiguationForDuplicateAliases` (`:160`) has no callers. The whole disambiguation feature is scaffolding.
- Unread columns: `placements.geometry_json` (the site reads `map_volumes.geometry_json` instead), `locations.game_location_id`, `locations.fast_travel_map_x/_y/_elevation`, `locations.display_on_enter_volume`, `portals.is_accessible`.
- Unused exports: `entities/item/operations.ts:3` (empty map), `relationship-graph.ts:84` `buildRelationshipDDL`, `:194` `countPipelineDiagnostics`.

The `source_*_json` and `*_ref_json` columns are **not** dead — they are deliberate provenance back to raw game data. `item_variants` and `site_read_models` are read only by `pipeline/test/site-metadata.test.ts`; confirm intent before touching.

### N2. SQLite constraints and indexes

`emit-sqlite.ts:50` sets `journal_mode` but never `PRAGMA foreign_keys = ON`, so the foreign keys declared on `tag_refs` and `location_volumes` are unenforced. Read paths lack supporting indexes: `item_tag_refs` has PK `(item_id, tag)` with no tag-leading index despite a correlated count query at `item-tag/read-models.ts:43-49`; `item-category/read-models.ts:60-64` runs a correlated `json_extract` scan per category; `map_points`/`map_volumes` are filtered by `entity_id`/`map_id` with no index. Several write loops run outside a transaction (`item/read-models.ts:141-150,168-178`; `emit-sqlite.ts:101-105`). At current data volume (1273 items, 81 placements) none of this is a live problem.

### N3. Silent stage no-ops

`emit-assets.ts:33-39` returns empty refs when `asset-manifest.json` is absent, with no diagnostic — a snapshot that lost its assets produces a complete-looking artifact with no icons. `load-snapshot.ts:50-70` overwrites `envelopes[entityId]` on duplicate ids without detection. `validate.ts:17-77` iterates only envelopes that are present, so a descriptor declaring `site` whose envelope is missing produces no canonical table and no complaint.

### N4. Guessed identifiers and masking defaults

`pipeline/src/map/read-models.ts:133-145` catches short-id derivation failure and fabricates `${entityType}-${entityId}`. `item/read-models.ts:113` defaults a missing descriptor route to `/items`. `site/src/routes/items/+page.server.ts:16-31` defaults missing metadata labels. Each masks absent source-of-truth data the fail-fast invariant says should surface.

### N5. Test gaps that matter

Ranked by consequence, not count:

1. **Slug / short-id collisions.** `pipeline/test/derive-slug.test.ts` covers derivation but never two ids sharing a prefix, nor identical display names. Collisions produce ambiguous public routes.
2. **Diagnostic severity aggregation.** `snapshot.test.ts:220-230` asserts only `fatal === 0`; no test covers severity mapping or manifest count consistency — directly related to M1 and C2.
3. **Fixture realism.** `fixtures/synthetic/` is too clean to exercise real failure modes: 5 items, 2 locations, 1 portal whose `connectedPortalRef` points at an absent portal. No duplicate ids, malformed refs, non-finite coordinates, or multi-map cases. Real exports carry 1273 items and 30 resolvable portal pairs.
4. **Rich-text.** `rich-text-v1.test.ts` covers well-formed input only — no nested or unterminated tags, no HTML escaping, no parser recovery.
5. **Artifact manifest tampering** — hash and count mismatch paths are untested.

Weak assertions worth tightening: `snapshot.test.ts:54` (`toBeDefined` only), `:130-132` (`every` over a possibly-empty array is vacuously true), `item-subtypes.test.ts:27-33` (asserts table existence, not schema).

`site/test` and several pipeline tests use `process.chdir` with `Date.now()`-named temp dirs (`site/test/map-read-models.test.ts:8,66`), which is racy under parallel execution.

### N6. Error-page reload control is inert

`site/src/routes/+error.svelte:35` calls `window.location.reload()`, but the root layout sets `csr = false` (`+layout.ts:6`) and only `/items` and `/map` override it. On any other route a non-404 error renders a Reload button that does nothing. The 404 branch omits the button, so only genuine errors are affected. Use an `href` to the current path instead.

### N7. Pre-push hook cost

`lefthook.yml:34-37` runs the full `bun typecheck` and `bun test` on every push. The repo forbids `--no-verify`; a slow hook is how that rule gets broken. (Note that the typecheck component is currently free precisely because of C1.)

---

## Dependency currency

Verified with `bun outdated` per workspace on 2026-08-02.

**The significant one.** TypeScript 7.0 reached GA on 2026-07-08 — the Go-native compiler, shipped as the ordinary `typescript` package with the ordinary `tsc` binary. This repo instead typechecks with `@typescript/native-preview` pinned to the floating `beta` tag, currently resolving to `7.0.0-dev.20260421.2`, an April nightly. npm's own description of that package is that it "will eventually be replaced by the official TypeScript package"; `tsgo` exists only in the preview. Meanwhile `typescript` is pinned `^6.0.3`.

So the build depends on a superseded preview compiler, from a floating tag, three months stale. **Recommendation:** drop `@typescript/native-preview`, move `typescript` to `^7`, and change `typecheck` to `tsc --noEmit`. Sequence this with C1 — fixing the empty project config and adopting TS 7 are the same piece of work. Verify `svelte-check` 4.7.x and `typescript-eslint` 8.65 against TS 7 before flipping.

Behind, worth a routine bump:

| Package | Current | Latest | Note |
| --- | --- | --- | --- |
| `@sveltejs/kit` | 2.59.1 | 2.70.2 | 11 minors |
| `@lucide/svelte` | 1.14.0 | 1.28.0 | 14 minors |
| `eslint` | 10.3.0 | 10.8.0 | |
| `typescript-eslint` | 8.59.2 | 8.65.0 | |
| `eslint-plugin-svelte` | 3.17.1 | 3.22.0 | |
| `prettier` | 3.8.3 | 3.9.6 | |
| `prettier-plugin-svelte` | 3.5.1 | 4.1.1 | major |
| `svelte` | 5.55.5 | 5.56.8 | |
| `svelte-check` | 4.4.8 | 4.7.4 | |
| `@deck.gl/*` | 9.3.3 | 9.3.7 | |
| `tailwindcss`, `@tailwindcss/vite` | 4.2.4 | 4.3.3 | |
| `sharp` | 0.34.5 | 0.35.3 | |
| `fast-check` | 4.7.0 | 4.9.0 | |
| `better-sqlite3` | 12.10.0 | 13.0.2 | major |
| `@types/better-sqlite3` | 7.6.13 | 9.6.0 | **two majors behind the runtime package** |

C# side: `BepInEx.Core` is pinned `5.4.21` while the deployed game loads BepInEx `5.4.23.4`; `xunit` 2.9.2 (v3 available) and `Microsoft.NET.Test.Sdk` 17.12.0 (18.x available).

Structural notes: `@hotrepl/protocol` and `@hotrepl/sdk` are root `dependencies` but consumed by `controller`, whose own `package.json` declares none — the controller only resolves via workspace hoisting and is not independently installable. All `site` runtime dependencies sit in `devDependencies`, which is defensible for a fully prerendered output but means the package is not runtime-installable.

There is no Python in this repository — no `.py` files, no `pyproject.toml` — so Ruff and the rest of the Python toolchain are not applicable.

---

## Planning coherence

### P1. Roadmap statuses are accurate except for two entries

Every slice marked `done` was verified against shipped code. Two are stale:

- **Slice 8+** is marked `planned` and its ordering still names Portals as the first candidate, but portal extraction, placement, and map markers shipped with Slice 7. Only `leads-to` edges remain. (Partially corrected in `552f0c7`; the ordering list still reads as though the entity is unbuilt.)
- **Slice 15** ("AGENTS.md per subsystem") is marked `planned`, but `AGENTS.md`, three subsystem files, and `CLAUDE.md` all exist. Either the slice is done or its remaining scope — worked examples — should be stated.

### P2. The active spec has drifted from what was built

`docs/plans/2026-06-04-compendium-data-architecture.md` is `status: active` and describes a system that differs from the one running:

- **§5** specifies `map_points`/`map_volumes` keyed by `entity_id` **and `layer_id`**. The shipped schema has no `layer_id` (`pipeline/src/map/read-models.ts:7-28`).
- **§3.2/§4** require every instance entity to carry a `definition_ref` (N:1 to its definition). `entities/portal/entity.json` has no `definition` block and `portal-ddl.ts` has no such column. Portals are instances with no definition — the spec's central rule, broken by the first instance entity built. Related to M4: the schema does not enforce it either.
- **§6/§9/§15** commit to a scene-extraction mechanism (`GuidComponent` instances). Not built: no `LoadSceneAsync`, `GuidComponent`, or `StaticSaveComponent` anywhere in `mod/src`.
- **§7** specifies generated bounded transitive spatial edges. Not emitted; portals carry only `connected_portal_ref_json`.

An active spec that misdescribes the shipped model is worse than no spec — it will be followed. **Recommendation:** reconcile §5, §3.2/§4, and §7 against reality, and mark the scene-extraction sections explicitly unbuilt with the slice that will deliver them.

### P3. Convention gaps

Both active docs have an empty `parent:` and the repo has **no** `type: overview` document, so the planning tree has no root. `omp-plans check` passes (32 docs), so this is convention drift rather than breakage.

---

## Verified healthy

Checked and found genuinely sound — recorded so future audits need not re-derive it:

- **Svelte 5 migration is complete.** Two independent passes found no `export let`, `$:`, `on:` directives, `createEventDispatcher`, or `<slot>` anywhere in `site/src`. `$effect` is used twice, both correctly, with cleanup.
- **Server boundary is clean.** Every import of `$lib/server/read-models` from outside `lib/server` is `import type`; `better-sqlite3` is reached only through a dynamic require in `site/src/lib/server/db.ts:52-67` and cannot enter a browser bundle.
- **CSR policy is coherent.** The `csr = false` default is deliberate, and both interactive routes (`/items`, `/map`) override it correctly. An earlier draft of this audit claimed `/items` filters were inert; that was **wrong** — `site/src/routes/items/+page.ts:2` sets `csr = true`.
- **Map accessibility has a real keyboard path.** `MapSearch` provides labelled, focusable selection equivalent to clicking canvas markers, so the WebGL canvas is not an accessibility dead end.
- **Release staging is correctly gated** — on the `stage-artifact.mjs` path (see C2 for the ungated duplicate). `site/static` is treated as a staging cache, not source.
- **TS strictness is strong** where it applies: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `isolatedModules`, `verbatimModuleSyntax` all enabled in `tsconfig.base.json`. The problem is C1, not the flags.
- **`check:validators` is enforced** in three CI jobs, so committed ajv output cannot drift from `schemas/`.
- **Every command referenced in the docs exists and works** — the only documentation defects are the dead `docs/superpowers/` paths (M11) and the missing env var (M12).
- **Snapshot writes are explicit DTOs.** No reflection dump or Odin serialization path exists today (see M7 for why the types still permit one).

---

## Suggested order

1. **C1** — nothing else can be trusted while the typechecker is blind, and it pairs naturally with the TypeScript 7 move.
2. **C2**, then **M1** and **M3** — close the paths from bad data to a deployable artifact.
3. **M6** — put the existing 145 uncovered tests into CI.
4. **M4** + **M5** + **P2** — settle the descriptor contract before Slice 8 is planned against it.
5. **M2**, **M12** — cheap, and directly prevent a repeat of the wrong-game incident.
6. **M11**, **P1**, **P3** — documentation and planning hygiene.
7. Everything under Minor, plus the routine dependency bumps.
