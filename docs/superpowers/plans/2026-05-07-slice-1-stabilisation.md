# Slice 1.5 — Stabilisation, Deployment, and Operational Hygiene

> **For agentic workers:** REQUIRED SUB-SKILL: Use `skill://executing-plans` for inline execution or `skill://subagent-driven-development` for parallel task execution. Steps use checkbox (`- [ ]`) syntax for tracking.

Date: 2026-05-07
Updated: 2026-05-14 after implementation-state audit.
Status: Ready after Phase 0 cleanup lands on `main`.
Spec coverage: `docs/superpowers/specs/2026-05-07-investment-priorities.md` §3 (foundation hygiene before breadth); `docs/superpowers/specs/2026-04-28-ardenfall-compendium-design.md` §16 open question 1 (deployment).
Predecessor: `docs/superpowers/plans/2026-05-03-item-walking-skeleton.md` (Slice 1, complete).
Worktree branch: `slice/1.5-stabilisation` at `.worktrees/slice-1-5-stabilisation/`.

## Goal

Close the loose ends from Slice 1 before Slice 2 multiplies their cost. Specifically:

0. Merge the 2026-05-14 plan-hygiene cleanup and add a root `dev` script so operators do not accidentally use pnpm.

1. Fix five identified defects in the HotRepl extraction path so manifest counts, walker work, and diagnostic context tell the truth.
2. Add a real error route to the site so failures during data fetch or unknown ids surface with intent rather than a generic SvelteKit error shell.
3. Wire the controller to call `game.quit` after extraction so live runs leave a clean process tree.
4. Ship the static site to `ardenfall.compendiums.org` so subsequent slices can be evaluated against a real URL.
5. Add an operational helper that drives `MainMenu → continue → world_Ardenfall` via HotRepl runtime-eval, so live smoke runs no longer require a human click.

This slice ships **no new entity coverage**, **no new presentation primitives** beyond the error route, and **no map work**. It is foundation work only.

## Non-goals

- No new item subtypes (Slice 2 owns that).
- No icon rendering (Slice 3 owns that).
- No tooltips, formatters, or inter-entity links (Slice 4 owns that).
- No locations or maps (Slice 5+ owns that).
- No FTS5 search or facets (Slice 10 owns that).
- No deployment-time secrets management. Deployment is local/operator-driven through the operator's Wrangler auth context, matching the Ancient Kingdoms setup; GitHub Actions deploy credentials are not planned for Slice 1.5.
- No deployment-time pivot beyond the Cloudflare adapter needed for `wrangler deploy`. The site remains an SPA shell (`ssr=false`, `prerender=false`); SSR and edge application logic are not planned.
- No pnpm support. This repository is a Bun workspace; root scripts should make the Bun path obvious instead of adding a second package-manager contract.

## Current observed implementation state

Verified on `main` at `7f8177d` before this plan update:

- Root branch `main` was clean and pushed to `origin`.
- Cleanup branch `slice/1.5-stabilisation` contained seven doc/plan hygiene commits through `d177e11`; those commits were not yet on `main`.
- `bun run typecheck` passed.
- `bun test pipeline/test` passed: 20 tests, 123 expectations.
- `bun test controller/test` passed: 13 tests, 30 expectations.
- `bun run --cwd site check` passed: 816 files, 0 errors, 0 warnings.
- `dotnet build mod/ArdenfallCompendium.csproj -c Debug` passed: 0 warnings, 0 errors.
- `bun run pipeline:run fixtures/synthetic/snapshot site/static && bun run --cwd site build` passed with `@sveltejs/adapter-static`.

Actual missing work on `main`:

- Root `package.json` has no `dev` script; the supported site dev command is currently `bun run --cwd site dev`.
- `mod/src/Control/Handlers/EntityPlanCommand.cs` still performs `new ItemExtractor().Walk().Count()`.
- `mod/src/Control/Handlers/EntityExportBatchCommand.cs` still performs a full `new ItemExtractor().Walk().ToList()` per batch.
- `mod/src/Control/Handlers/RunFinalizeCommand.cs` still passes an empty `new DiagnosticTotals()` to `ManifestBuilder.Build`.
- There is no `mod-tests/` project on `main`.
- `controller/src/export-orchestrator.ts` does not call `game.quit` and has no `waitForWorld` flow.
- `site/src/routes/+error.svelte` does not exist.
- `site/svelte.config.js` still uses `@sveltejs/adapter-static`; `site/wrangler.toml` does not exist.

## Bug inventory

The five defects this slice fixes, all in `mod/src/Control/Handlers/`:

### B1 — `RunFinalizeCommand` writes empty `DiagnosticTotals`

**File:** `mod/src/Control/Handlers/RunFinalizeCommand.cs`
**Line:** 69
**Symptom:** `manifest.diagnostics = { fatal: 0, diagnostic: 0 }` regardless of what the rows contain.
**Reality:** today's live snapshot has 898 row-level `lookupAssetGuidMissing` diagnostics + 1 `nullAsset`; manifest reports 0/0.
**Root cause:** `diagnostics: new DiagnosticTotals()` passed straight to `ManifestBuilder.Build` without aggregating from chunks or from the cached walker run.
**Fix:** aggregate per-row diagnostics from every chunk plus walker-level diagnostics from the cached run (B4 fix), then pass the totals to `ManifestBuilder.Build`. Also persist the per-row diagnostic detail into the published `items.json` (already does) and emit walker-level diagnostics into a sibling `diagnostics.json` if any are present, so callers can audit the full diagnostic stream.

### B2 — `EntityPlanCommand` re-runs the full walker just to count

**File:** `mod/src/Control/Handlers/EntityPlanCommand.cs`
**Line:** 28
**Symptom:** `entity.plan` triggers a complete walk of `BuiltLookupTable.GetAssetsOfType<ItemData>()` purely to compute a row count.
**Cost (today):** ~899 items × 1 walk = 899 extractions for one count.
**Fix:** see B3 — the walk is moved to a single owning point, and `entity.plan` reads the cached row count.

### B3 — `EntityExportBatchCommand` re-runs the full walker per batch

**File:** `mod/src/Control/Handlers/EntityExportBatchCommand.cs`
**Line:** 36
**Symptom:** every `entity.exportBatch` call constructs `new ItemExtractor()` and walks the full asset list, then keeps only the slice `[offset, offset+limit]`.
**Cost (today):** for a default batch size of 100 against 899 items, that is 9 batches × full walk = ~8,100 extractions to produce 899 rows. Combined with B2 that is ~9,000 extractions.
**Worst-case cost (Slice 2 hypothesis):** if Slice 2 brings the item count to ~3,000 (full ItemData breadth), the same code does ~30 walks × 3,000 items = 90,000 extractions per run.
**Fix:** the walker runs once per run, the produced rows are cached on `CompendiumRun`, and `entity.exportBatch` reads `Take(offset, limit)` from the cached list. The natural owner is a new `ItemExtractionService` that `entity.plan` invokes (lazily) and stores on the run; subsequent commands reuse it.

### B4 — Walker-level diagnostics dropped between batches

**Same files as B2/B3.**
**Symptom:** each `new ItemExtractor()` accumulates `Diagnostics` (including `Refs.Diagnostics` from ref-resolution failures; today this includes the 898 `lookupAssetGuidMissing` references that resolve to per-row diagnostics, but in general also includes failures that aren't bound to any specific row). The extractor instance is GC'd after the chunk slice is written; its walker-level `Diagnostics` go nowhere.
**Fix:** caching the rows on `CompendiumRun` (B3 fix) also caches walker-level `Diagnostics` and `Refs.Diagnostics`. `RunFinalizeCommand` reads them and aggregates into the manifest totals (B1 fix) plus emits a `diagnostics.json` sibling if non-empty.

### B5 — Slicing depends on unverified iteration order

**Same files as B2/B3.**
**Symptom:** `BuiltLookupTable.GetAssetsOfType<T>()` is called multiple times across `entity.plan` + N batches; if iteration order is not stable, batch slicing duplicates or skips items.
**Why this hasn't bitten yet:** Demo2025 BuiltLookupTable appears to iterate in a stable order (live exports produce 899 distinct items consistently), but the contract is not documented.
**Fix:** the B3 fix eliminates re-iteration entirely. The walker runs exactly once per run; downstream commands read the immutable cached list.

### Site-side defect

**B6 — Site has no `+error.svelte`**

**File:** `site/src/routes/` (currently no error route).
**Symptom:** `error(404, ...)` from `+page.ts` `load()` and runtime errors from `getDb()` (sqlite fetch failure, `sqlite3_deserialize` rc != 0) bubble to a default SvelteKit error page. In SPA mode this is opaque to users.
**Fix:** add `site/src/routes/+error.svelte` with a clear message keyed on `$page.status`, a path back to `/`, and (for unknown errors) a request-id surface so users can quote it in a bug report. The route is generic — applies to all routes in the SPA, not just `/items/[id]`.

## Phases

Phases run sequentially through Phase C because the bug fixes share refactor surface. Phase 0 is operational cleanup that must land before implementation resumes. Within a phase, tasks parallelise where indicated.

### Phase 0 — Plan hygiene and root developer command

#### Task 0.1 — Merge the plan-hygiene cleanup branch to `main`

**Files:**

- Already modified on branch `slice/1.5-stabilisation`:
  - `.github/workflows/ci.yml`
  - `docs/superpowers/plans/2026-05-03-item-walking-skeleton.md`
  - `docs/superpowers/plans/2026-05-07-slice-1-stabilisation.md`
  - `docs/superpowers/specs/2026-04-28-ardenfall-compendium-design.md`
  - `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md`
  - `docs/superpowers/specs/2026-05-03-slice1-tooling-decisions.md`
  - `mod/AGENTS.md`
  - `mod/src/Plugin.cs`
  - `mod/src/Triggers/ConsoleCommand.cs`

- [ ] **Step 1: Verify branch relationship**

Run from repository root:

```sh
git status --short --branch
git log --oneline main..slice/1.5-stabilisation
```

Expected: `main` is clean, and the branch log contains the cleanup commits ending at `d177e11 docs(specs): close resolved baseline questions`.

- [ ] **Step 2: Fast-forward `main`**

Run from repository root:

```sh
git switch main
git merge --ff-only slice/1.5-stabilisation
```

Expected: `main` advances to `d177e11`; no merge commit is created.

- [ ] **Step 3: Verify cleanup build safety**

Run:

```sh
bun run format:check
dotnet build mod/ArdenfallCompendium.csproj -c Debug
```

Expected: format check passes, and the mod build exits with `0 Warning(s)` and `0 Error(s)`. The build proves deleting `mod/src/Triggers/ConsoleCommand.cs` left no dangling C# references.

- [ ] **Step 4: Push**

Run:

```sh
git push origin main
```

Expected: pre-push typecheck and tests pass; `origin/main` advances to `d177e11`.

#### Task 0.2 — Add a root `dev` script for the SvelteKit site

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Verify the current root command fails for the right reason**

Run:

```sh
bun run dev -- --help
```

Expected before implementation: Bun reports that script `dev` is not found at the workspace root. This captures the operator-facing gap without introducing pnpm support.

- [ ] **Step 2: Add the root script**

Modify the root `package.json` `scripts` block to include `dev`:

```json
{
  "scripts": {
    "dev": "bun run --cwd site dev",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "bunx tsgo --noEmit -p .",
    "codegen:validators": "bun run pipeline/scripts/codegen-validators.ts",
    "check:fixtures": "bun run pipeline/scripts/check-fixtures.ts",
    "pipeline:run": "bun run pipeline/src/cli.ts run",
    "controller:deploy": "bun run controller/src/deploy.ts",
    "controller:export": "bun run controller/src/cli.ts export",
    "controller:test": "bun test controller/test"
  }
}
```

Do not add `pnpm-workspace.yaml`; Bun remains the single package-manager contract.

- [ ] **Step 3: Verify the root command reaches Vite**

Run:

```sh
bun run dev -- --help
```

Expected after implementation: Vite prints its help text and exits successfully.

- [ ] **Step 4: Verify package JSON formatting**

Run:

```sh
bun run format:check package.json
```

Expected: Prettier reports `All matched files use Prettier code style!`.

- [ ] **Step 5: Commit**

```sh
git add package.json
git commit -m "chore(repo): add root site dev script"
```

**Phase 0 gate:** `main` contains the plan-hygiene cleanup commits, `mod/src/Triggers/ConsoleCommand.cs` is gone, `bun run dev -- --help` reaches Vite, and `dotnet build mod/ArdenfallCompendium.csproj -c Debug` exits 0/0/0.

### Phase A — C# test project foundation

Without a C# test project for the mod, none of the bug fixes can be verified except by live smoke. Slice 1.5 adds the test project so future slices have a real regression substrate.

#### Task A.1 — Create `mod-tests/ArdenfallCompendium.Tests.csproj`

**Files:**

- Create: `mod-tests/ArdenfallCompendium.Tests.csproj`
- Create: `mod-tests/.gitignore` (entries for `bin/`, `obj/`)
- Modify: no solution file exists; `ardenfall-compendium` is dotnet-built via `mod/ArdenfallCompendium.csproj` directly, so the test project is run standalone via `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`.

- [ ] **Step 1: Decide framework.** Use `xunit` 2.9+ with `xunit.runner.visualstudio`. xUnit is the dotnet-ecosystem default and integrates cleanly with `dotnet test`. Target `net10.0` for the test project because the local toolchain only has the .NET 10 runtime installed (test runner does not need to match the mod's `netstandard2.1`); the test project references the mod's source by `<ProjectReference Include="..\mod\ArdenfallCompendium.csproj"/>` so test code can call mod types directly.

- [ ] **Step 2: Write the csproj.**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\mod\ArdenfallCompendium.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 3: Add a smoke test.**

```csharp
// mod-tests/SmokeTests.cs
using Xunit;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Tests;

public sealed class SmokeTests
{
    [Fact]
    public void TestProjectLinksMod() => Assert.Equal("ArdenfallCompendium", typeof(Manifest).Assembly.GetName().Name);
}
```

- [ ] **Step 4: Verify build + run.**

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
```

Expected: `Passed: 1, Failed: 0`. The test project compiles the mod through the project reference, so it requires local `mod/libs/` references populated by `mod/scripts/copy-libs.sh`. It is intentionally a local regression substrate, not a GitHub CI job.

- [ ] **Step 5: Keep CI format-only.** Do not add a GitHub `mod-tests` job in Slice 1.5. GitHub cannot compile the mod project without non-redistributable game DLLs in `mod/libs/`; `.github/workflows/ci.yml` continues to verify `dotnet format` for `mod/**`, while local development verifies behavior with `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`.

- [ ] **Step 6: Commit.**

```sh
git add mod-tests/ docs/superpowers/plans/2026-05-07-slice-1-stabilisation.md
git commit -m "test(mod): bootstrap xunit test project for ArdenfallCompendium"
```

**Phase A gate:** `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj` passes locally with `mod/libs/` populated. CI remains format-only for `mod/**`.

Implementation note: the test project targets `net10.0` because this workstation has only the .NET 10 runtime installed. The smoke test links through `ArdenfallCompendium.Dtos.Manifest` rather than `Plugin` so local tests do not force UnityEngine native calls during assembly loading. `mod/scripts/copy-libs.sh` now copies `Sirenix.Serialization.Config.dll`, and `mod-tests/ArdenfallCompendium.Tests.csproj` copies the game references it needs into the test output.

### Phase B — Refactor for testability + cache rows on the run

#### Task B.1 — Extract `ItemExtractionService`

**Files:**

- Create: `mod/src/Extraction/ItemExtractionService.cs`
- Modify: `mod/src/Control/CompendiumRun.cs`

The current `EntityPlanCommand` and `EntityExportBatchCommand` both call `new ItemExtractor().Walk()` directly. The fix is to make extraction a one-time-per-run operation owned by a service that caches its result on the run.

- [ ] **Step 1: Write the failing test.** In `mod-tests/ItemExtractionServiceTests.cs`, write a test that asserts `ItemExtractionService.GetOrExtract(run)` returns the same `IReadOnlyList<ItemSnapshotRow>` instance on the second call (reference equality), proving that re-walking does not happen. The test substitutes a fake `IItemAssetSource` that counts how many times it is enumerated; the assertion is `assetSource.WalkCount == 1` after two `GetOrExtract` calls.

```csharp
// mod-tests/ItemExtractionServiceTests.cs
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Extraction;
using Xunit;

public sealed class ItemExtractionServiceTests
{
    [Fact]
    public void Caches_rows_after_first_walk()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var run = new CompendiumRun { RunId = "test" };

        var first = service.GetOrExtract(run);
        var second = service.GetOrExtract(run);

        Assert.Same(first, second);
        Assert.Equal(1, source.WalkCount);
    }
}
```

`CountingItemAssetSource` is a fake implementing the new `IItemAssetSource` interface; for this test it returns an empty enumerable but increments `WalkCount` on each enumeration.

Implementation note: `CompendiumRun.GameVersion` now defaults to `"unknown"` instead of eagerly reading `UnityEngine.Application.version`; `RunBeginCommand` remains the runtime path that stamps the real sanitized game version. This keeps command/service tests executable outside Unity.

- [ ] **Step 2: Add the `IItemAssetSource` seam.**

```csharp
// mod/src/Entities/Item/IItemAssetSource.cs
namespace ArdenfallCompendium.Entities.Item;

public interface IItemAssetSource
{
    System.Collections.Generic.IEnumerable<Ardenfall.Item.ItemData> EnumerateItems();
}
```

The default production implementation:

```csharp
// mod/src/Entities/Item/BuiltLookupTableItemAssetSource.cs
namespace ArdenfallCompendium.Entities.Item;

public sealed class BuiltLookupTableItemAssetSource : IItemAssetSource
{
    public System.Collections.Generic.IEnumerable<Ardenfall.Item.ItemData> EnumerateItems()
        => Ardenfall.BuiltLookupTable.GetAssetsOfType<Ardenfall.Item.ItemData>();
}
```

`ItemExtractor` gains a constructor taking `IItemAssetSource`; its `Walk()` body changes from `foreach (var asset in BuiltLookupTable.GetAssetsOfType<ItemData>())` to `foreach (var asset in _source.EnumerateItems())`. The handler-side construction sites pass `new BuiltLookupTableItemAssetSource()`.

- [ ] **Step 3: Add `ItemExtractionService`.**

```csharp
// mod/src/Extraction/ItemExtractionService.cs
using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;

namespace ArdenfallCompendium.Extraction;

public sealed class ItemExtractionService
{
    private readonly IItemAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public ItemExtractionService(IItemAssetSource source) { _source = source; }

    public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run)
        => GetState(run).Rows;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run)
        => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;
        var extractor = new ItemExtractor(_source);
        var rows = new List<ItemSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);
        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(IReadOnlyList<ItemSnapshotRow> Rows, IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
```

The service is instantiated once at plugin startup and registered with the same DI surface the command handlers use today (constructor injection through `CompendiumCommandRegistry`).

- [ ] **Step 4: Update `CompendiumCommandRegistry`** to construct and pass the `ItemExtractionService` to `EntityPlanCommand`, `EntityExportBatchCommand`, and `RunFinalizeCommand`. Verify the smoke test from Phase A still passes (no Unity type loading).

- [ ] **Step 5: Run.**

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
```

Expected: 2 pass (smoke + cache test). The cache test originally fails (red) until Step 3 lands.

- [ ] **Step 6: Commit.**

```sh
git add mod/ mod-tests/ItemExtractionServiceTests.cs
git commit -m "refactor(mod): extract ItemExtractionService with cached rows per run"
```

#### Task B.2 — Wire `EntityPlanCommand` to read from the cache

**Files:**

- Modify: `mod/src/Control/Handlers/EntityPlanCommand.cs`
- Modify: `mod-tests/EntityPlanCommandTests.cs` (new)

- [ ] **Step 1: Write the failing test.** Assert that `entity.plan` causes exactly one walk (via `CountingItemAssetSource`).

- [ ] **Step 2: Refactor.** `EntityPlanCommand` takes `ItemExtractionService` in its constructor. Its `ExecuteAsync` looks up the run, calls `service.GetOrExtract(run)`, and reads `.Count`.

- [ ] **Step 3: Run + commit.**

```sh
git commit -m "fix(mod): entity.plan reads cached row count instead of re-walking"
```

#### Task B.3 — Wire `EntityExportBatchCommand` to read from the cache

**Files:**

- Modify: `mod/src/Control/Handlers/EntityExportBatchCommand.cs`
- Modify: `mod-tests/EntityExportBatchCommandTests.cs` (new)

- [ ] **Step 1: Write the failing test.** Assert that two `entity.exportBatch` calls (offset 0 + offset 100) cause exactly one walk.

- [ ] **Step 2: Refactor.** `EntityExportBatchCommand` takes `ItemExtractionService`. Its `ExecuteAsync` calls `service.GetOrExtract(run)` and slices via `Skip(offset).Take(limit)`. The chunk file path remains `{offset:D6}.json`.

- [ ] **Step 3: Run + commit.**

```sh
git commit -m "fix(mod): entity.exportBatch slices cached rows instead of re-walking"
```

**Phase B gate:** `ItemExtractionServiceTests`, `EntityPlanCommandTests`, and `EntityExportBatchCommandTests` all pass. Walker invocation count is exactly 1 per run regardless of batch count. `dotnet build mod/ArdenfallCompendium.csproj` exits 0/0/0; `dotnet format mod/ArdenfallCompendium.csproj --verify-no-changes` exits 0.

### Phase C — Diagnostic-counting fix

#### Task C.1 — Aggregate per-row + walker-level diagnostics in `RunFinalizeCommand`

**Files:**

- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Modify: `mod/src/Extraction/ItemExtractionService.cs`
- Create: `mod/src/Extraction/IItemExtractionCache.cs`
- Modify: `mod-tests/RunFinalizeCommandTests.cs` (new)
- Create: `schemas/diagnostics.schema.json`
- Modify: `pipeline/scripts/codegen-validators.ts`
- Modify: `pipeline/src/stages/load-snapshot.ts`
- Modify: `pipeline/src/stages/validate.ts`
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/test/snapshot.test.ts`
- [ ] **Step 1: Write the failing test.** Set up a workspace dir with a chunks dir containing two chunks: chunk A has one row with two `diagnostic`-severity diagnostics, chunk B has one row with one `fatal` diagnostic. Walker-level diagnostics list contains one `diagnostic`. Invoke `RunFinalizeCommand.ExecuteAsync`. Assert the published manifest has `diagnostics: { fatal: 1, diagnostic: 3 }`. Assert a `diagnostics.json` sibling exists with all four entries.

- [ ] **Step 2: Refactor.** `RunFinalizeCommand`:
  1. Reads chunk JSONs as today.
  2. Aggregates per-row diagnostics across all chunks into a `DiagnosticTotals`.
  3. Adds walker-level diagnostics from `service.GetWalkerDiagnostics(run)` to the totals.
  4. Writes `diagnostics.json` next to `items.json` if any diagnostics exist (per-row + walker-level entries combined into one stream, each tagged with its source: `"rowId"` for per-row, `null` for walker-level).
  5. Passes the aggregated totals to `ManifestBuilder.Build`.

- [ ] **Step 3: Add the diagnostics artifact contract.** Add `schemas/diagnostics.schema.json` for the optional `diagnostics.json` sibling. `pipeline/src/stages/load-snapshot.ts` skips it as an entity envelope, validates it when present, and exposes its entries as `SnapshotDiagnosticArtifactEntry[]`. `pipeline/src/stages/validate.ts` counts those entries alongside row diagnostics. Regenerate validators.

- [ ] **Step 4: Run.**

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj
bun test pipeline/test
bun run typecheck
```

Expected: all green. The pipeline tests should not regress because the synthetic fixture has no diagnostics; if pipeline tests need updating to read the new artifact, do it as part of this task.

- [ ] **Step 5: Commit.**

```sh
git commit -m "fix(mod): aggregate per-row + walker diagnostics into manifest totals"
```

**Phase C gate:** `RunFinalizeCommandTests` passes; live re-export against Demo2025 produces a manifest with `diagnostics.diagnostic` ≈ 898 (matching the per-row `lookupAssetGuidMissing` count) instead of 0.

### Phase D — Site error route

#### Task D.1 — Add `+error.svelte`

**Files:**

- Create: `site/src/routes/+error.svelte`
- Create: `site/scripts/smoke-error-route.mjs`
- Modify: `site/package.json`

- [ ] **Step 1: Write a failing smoke test.** Add `site/scripts/smoke-error-route.mjs` and `site/package.json` script `smoke:error-route`. The script must fail while `site/src/routes/+error.svelte` is absent, then pass once the route includes status text, 404 copy, the home link, and reload affordance.

- [ ] **Step 2: Implement `+error.svelte`** with status-keyed messaging:

```svelte
<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button/index.js";
</script>

<section class="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-16">
  <p class="text-muted-foreground text-sm tracking-widest uppercase">Error {page.status}</p>
  <h1 class="text-3xl font-semibold">{page.error?.message ?? "Something went wrong"}</h1>
  <p class="text-muted-foreground">
    {#if page.status === 404}
      That item doesn't exist in the current snapshot. It may have been removed in a later patch or
      never existed at all.
    {:else}
      An unexpected error occurred while loading this page. The page reload below may resolve it; if
      it doesn't, the error message above is the most actionable thing to share.
    {/if}
  </p>
  <div class="flex gap-2">
    <Button href={resolve("/")}>Back to home</Button>
    {#if page.status !== 404}
      <Button variant="outline" onclick={() => window.location.reload()}>Reload</Button>
    {/if}
  </div>
</section>
```

- [ ] **Step 3: Verify.**

```sh
bun run --cwd site smoke:error-route
bun run --cwd site check
bun run --cwd site build
```

Expected: smoke script passes, Svelte check reports 0 errors / 0 warnings, and build emits successfully. Local browser verification against Vite preview should exercise the route; if the SQLite WASM loader fails first, the page should still render the non-404 branch of `+error.svelte`.

- [ ] **Step 4: Commit.**

```sh
git commit -m "feat(site): error route with status-keyed messaging"
```

**Phase D gate:** site error route renders for 404 (unknown item id) and for runtime fetch failures. Smoke test in Step 1 is committed and runs locally.

### Phase E — Controller `game.quit` integration

#### Task E.1 — Call `game.quit` after success and after failure

**Files:**

- Modify: `controller/src/export-orchestrator.ts`
- Modify: `controller/test/export-orchestrator.test.ts`

- [ ] **Step 1: Write failing tests.** Two new cases in `export-orchestrator.test.ts`:
  1. Success path: assert `game.quit` is invoked after `run.finalize` succeeds.
  2. Failure path: assert `game.quit` is invoked when `run.finalize` rejects (and the controller propagates the original error).

- [ ] **Step 2: Implement.** Add `game.quit` to the expected command list. Call it in a `try/finally` after `run.finalize`, with the call wrapped in a best-effort try/catch (a quit failure must not mask an export failure or change the exit code reported to the operator). Add an option `noQuit` to the export orchestrator for headless test mode where quitting is undesirable; default `false` (quit by default).

- [ ] **Step 3: Run.**

```sh
bun test controller/test
```

Expected: 15 pass (13 existing + 2 new). All other tests still pass.

- [ ] **Step 4: Commit.**

```sh
git commit -m "feat(controller): invoke game.quit after export success or failure"
```

**Phase E gate:** controller tests pass; live re-export against Demo2025 results in `Ardenfall.exe` exiting cleanly after `pipeline/dist/data.sqlite` is written.

### Phase F — `MainMenu → continue → world_Ardenfall` automation helper

#### Task F.1 — Typed HotRepl continue helper invoked from controller

**Files:**

- Create: `controller/src/wait-for-world.ts`
- Modify: `controller/src/export-orchestrator.ts`
- Modify: `controller/src/cli.ts`
- Modify: `controller/test/wait-for-world.test.ts` (new)
- Modify: `controller/test/export-orchestrator.test.ts`
- Create: `mod/src/Control/Handlers/ContinueFromMenuCommand.cs`
- Modify: `mod/src/Control/CompendiumCommandRegistry.cs`
- Modify: `mod/ArdenfallCompendium.csproj`
- Modify: `mod/scripts/copy-libs.sh`

- Modify: `controller/src/deploy.ts` and `controller/test/deploy.test.ts` (live smoke found the pre-rename `ArdenfallArchives` runtime plugin directory still present in the CrossOver bottle; deploy now removes that obsolete plugin directory before copying current DLLs)
- [ ] **Step 1: Identify the automation target.** The controller cannot use the eval REPL through `HotReplClient`'s typed-control surface, and typed commands are the supported automation API. Implement the robust path directly: a `compendium.continueFromMenu` command finds an active interactable `UnityEngine.UI.Button` whose name or child `Text` contains "continue" and invokes `onClick`.

  The helper exposes:

  ```ts
  await waitForWorld(client, { timeoutMs: 60_000 });
  ```

  which, in order:
  1. Polls `compendium.preflight`. If it passes immediately (already in world), returns.
  2. If preflight reports `ardenfallGame: not initialized`, calls typed command `compendium.continueFromMenu`.
  3. Polls `compendium.preflight` until it passes or `timeoutMs` elapses.
  4. Returns or throws a clear timeout error with the last preflight reason.

- [ ] **Step 2: Write the failing tests.** Mock the HotRepl client; assert the helper polls preflight, sends `compendium.continueFromMenu` on first failure, and returns when preflight passes. Add an export-orchestrator test proving `waitForWorld: true` runs before `run.begin`.

- [ ] **Step 3: Implement.** Add `controller/src/wait-for-world.ts`, wire `exportCompendium({ waitForWorld: true })`, and make `controller:export` default to waiting for live runs with `--no-wait-for-world` as the unit-test/manual override. Retry `compendium.continueFromMenu` while preflight remains not-ready because a freshly launched game can accept HotRepl connections before the menu's Continue button exists.

- [ ] **Step 5: Run + live-verify.**

```sh
bun test controller/test
bun run typecheck
dotnet build mod/ArdenfallCompendium.csproj -c Debug
# then a live run:
bun run controller:deploy …
bun run controller:export …
```

Expected: live run succeeds without a human click on `Continue`.

Live smoke note: initial live attempt exposed two runtime hygiene issues not visible in unit tests. First, the CrossOver bottle still had the obsolete `BepInEx/plugins/ArdenfallArchives` directory, causing the old plugin to load alongside `ArdenfallCompendium`; `controller:deploy` now removes that directory. Second, HotRepl can accept connections before the menu Continue button exists, so `waitForWorld` now retries `compendium.continueFromMenu` until preflight passes or the timeout expires. Verified live on 2026-05-14: fresh CrossOver launch, `waitForWorld` completed, nine item batches exported, snapshot `snapshots/snapshots/0.0.10.91-20260514-0630464614460` published with `counts.item = 899`, `diagnostics = { fatal: 0, diagnostic: 1273 }`, `pipeline/dist/data.sqlite` written at 1,482,752 bytes, and `game.quit` closed HotRepl port 18590.

- [ ] **Step 6: Commit.**

```sh
git commit -m "feat(controller): wait-for-world helper drives MainMenu continue automatically"
```

**Phase F gate:** unattended live smoke run from a fresh game launch through to pipeline output works without any manual interaction beyond invoking the controller CLI.

### Phase G — Deployment to `ardenfall.compendiums.org`

#### Task G.1 — Decide hosting target

**Status:** Closed in this plan.

Cloudflare Workers Static Assets via SvelteKit's `adapter-cloudflare` and `wrangler deploy`, modelled directly on Ancient Kingdoms' `website/wrangler.toml` + `pnpm cf-deploy` setup.

Observed Ancient Kingdoms setup:

- `website/svelte.config.js` uses `@sveltejs/adapter-cloudflare`.
- `website/wrangler.toml` points `main` at `.svelte-kit/cloudflare/_worker.js`, sets `workers_dev = false`, binds the custom domain route, and declares `[assets] directory = ".svelte-kit/cloudflare"`.
- `website/package.json` has `"cf-deploy": "wrangler deploy"`.
- There is no checked-in GitHub Actions deploy workflow and no repo-side `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` assumption. Deployment uses Wrangler auth (`wrangler login`) from the operator environment.

Rationale:

- This matches the existing `compendiums.org` umbrella pattern instead of introducing a second Cloudflare product path.
- Wrangler owns project creation / upload / route binding after the initial Cloudflare login and custom-domain setup. No GitHub secrets are required for the initial deployment flow.
- Ardenfall's site remains an SPA (`ssr=false`, `prerender=false`) even under `adapter-cloudflare`; the Worker is the Cloudflare Static Assets entrypoint and routing shell, not an SSR or edge-application surface.

#### Task G.2 — Wire `adapter-cloudflare` + Wrangler deploy

**Files:**

- Modify: `site/package.json` (add `@sveltejs/adapter-cloudflare`, `wrangler`, `cf-deploy`)
- Modify: `site/svelte.config.js` (switch from `adapter-static` to `adapter-cloudflare`)
- Create: `site/wrangler.toml`
- Modify: `site/AGENTS.md` (document deploy and login assumptions)
- Modify: `site/src/routes/items/[id]/+page.ts` and `site/src/routes/+error.svelte` (deployment verification found the unknown-item SPA path surfaced status 500 unless the error route derives item-not-found display state from the thrown error message)

- [ ] **Step 1: Add Cloudflare deploy dependencies.** In `site/package.json`, add current stable `@sveltejs/adapter-cloudflare` and `wrangler` dev dependencies. Add:

  ```json
  "cf-deploy": "wrangler deploy"
  ```

- [ ] **Step 2: Switch SvelteKit adapter.** `site/svelte.config.js` imports `@sveltejs/adapter-cloudflare` and configures `adapter: adapter({})`. Preserve the existing SPA behavior from `site/src/routes/+layout.ts` (`ssr = false`, `prerender = false`).

- [ ] **Step 3: Add `site/wrangler.toml`.** Model after Ancient Kingdoms:

  ```toml
  name = "ardenfall-compendium-site"
  main = ".svelte-kit/cloudflare/_worker.js"
  compatibility_date = "2026-05-07"
  compatibility_flags = ["nodejs_compat"]

  workers_dev = false

  [[routes]]
  pattern = "ardenfall.compendiums.org"
  custom_domain = true

  [assets]
  directory = ".svelte-kit/cloudflare"
  binding = "ASSETS"
  ```

  `name` intentionally uses `ardenfall-compendium-site` to match the new domain/project naming direction.

- [ ] **Step 4: Keep CI as verification, not deployment.** `.github/workflows/ci.yml` keeps building the site (including the synthetic SQLite copy step) but does **not** deploy. Deployment is local/operator-driven for Slice 1.5:

  ```sh
  rm -f site/static/data.sqlite
  bun run pipeline:run fixtures/synthetic/snapshot site/static
  bun run --cwd site smoke:error-route
  bun run --cwd site check
  bun run --cwd site build
  bun run --cwd site cf-deploy
  ```

  Automated GitHub deploys, preview deploys, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` are out of scope and unplanned for Slice 1.5. Add a separate operations plan before introducing any CI credential model.

- [ ] **Step 5: Custom domain.** Configure `ardenfall.compendiums.org` as a custom domain/route in the Cloudflare account if Wrangler does not create the route automatically on first deploy. DNS record management lives in the `compendiums.org` umbrella account.

- [ ] **Step 6: Update `site/AGENTS.md`** to document:
  - `bun run --cwd site cf-deploy` is the deploy command.
  - The operator must be logged in with Wrangler (`wrangler login`) or otherwise have a valid Wrangler auth context.
  - CI verifies the deployable build but does not deploy.

- [ ] **Step 7: Verify.** From a Wrangler-authenticated shell, run the deploy commands in Step 4. Verify `https://ardenfall.compendiums.org/items` resolves and renders the synthetic-fixture-derived data. Verify a known detail route renders. Verify an unknown item URL reaches the SPA shell and renders `+error.svelte` with visible `ERROR 404`.

- [ ] **Step 8: Commit (per logical chunk).**

  ```sh
  git commit -m "feat(site): cloudflare static assets deploy config"
  git commit -m "docs(site): document wrangler deploy workflow"
  ```

**Phase G gate:** `https://ardenfall.compendiums.org/items` returns the rendered overview page with the deployed SQLite blob's contents. `https://ardenfall.compendiums.org/items/<known-id>` returns the detail page. Unknown URLs hit the SPA shell and render `+error.svelte` with status 404.

Deployment note: deployed `ardenfall-compendium-site` to Cloudflare version `d8bb5080-eaf8-4e69-9c1c-d223fb1ecdd7` on 2026-05-14. Browser verification observed `/items` rendering both synthetic items, `/items/fixture-iron-sword` rendering the detail page, and `/items/does-not-exist` rendering `+error.svelte` with visible `ERROR 404`.

## Self-review

### Spec coverage trace

| Deliverable                            | Task     |
| -------------------------------------- | -------- |
| Plan-hygiene cleanup merged to `main`  | 0.1      |
| Root Bun `dev` script                  | 0.2      |
| C# test project foundation             | A.1      |
| `ItemExtractionService` cache          | B.1      |
| `entity.plan` reads cached count       | B.2      |
| `entity.exportBatch` reads cached rows | B.3      |
| Aggregate per-row + walker diagnostics | C.1      |
| Site `+error.svelte`                   | D.1      |
| Controller `game.quit`                 | E.1      |
| `wait-for-world` automation            | F.1      |
| Cloudflare Static Assets deployment    | G.1, G.2 |

### Bug-to-task trace

| Bug | Task     |
| --- | -------- |
| B1  | C.1      |
| B2  | B.2      |
| B3  | B.3      |
| B4  | B.1, C.1 |
| B5  | B.1      |
| B6  | D.1      |

### Open spec items intentionally not closed

- Real-derived fixture curation (`fixtures/scripts/curate-capsule.ts`) — Slice 2 trigger (first stable extraction across all subtypes).
- FTS5 / facets — Slice 10 owns these.
- Asset extraction — Slice 3 owns this; Slice 1.5 does not put icons on items.

### Placeholder scan

No placeholder markers appear in implementation steps. The genuine deferrals are explicit: real-fixture curation (Slice 2 trigger) and deployment automation beyond local Wrangler.

### Type / signature consistency

- `IItemAssetSource` is consistent across the production source (`BuiltLookupTableItemAssetSource`), the test fake (`CountingItemAssetSource`), and the consumer (`ItemExtractor`).
- `DiagnosticTotals` shape (`{ fatal, diagnostic }`) matches across `mod/src/Dtos/Manifest.cs`, the new aggregation in `RunFinalizeCommand`, and `pipeline/src/stages/validate.ts`.
- `CompendiumRun.Counts["item"]` semantics: kept as "items written so far" while a run is open; replaced with the cached row count on finalize.
- Active unsupported-item diagnostic naming is slice-neutral: `ItemDiagnosticCodes.UnsupportedSubtype = "itemSubtypeUnsupported"`. The old slice-specific diagnostic code is removed from runtime code before Slice 2 starts.

### Known risks remaining

1. **Cloudflare Workers/Static Assets free tier limits.** Slice 1.5 has local/operator deploys only; CI deploys and PR preview deploys are unplanned. Monitor Worker and build limits only if a future operations plan adds those deployment modes.
2. **Synthetic-fixture-derived deploy.** Until a real snapshot is archived externally and copied into CI, the deployed site only knows the 2 synthetic items. This is acceptable for Slice 1.5 (deployment exists; content thinness is real but not a deployment defect) and is fixed in Slice 13 (versioning + snapshot archive).

### Execution handoff

Plan complete. Execute in this order:

1. **Phase 0 inline on `main`** — merge the cleanup branch and add the root `dev` script.
2. **Phases A → C** — execute sequentially because they share refactor surface and tests.
3. **Phases D → G** — parallelise across separate agents only after Phase C is green.

Two execution options for Phases A onward:

1. **Subagent-driven** — dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit after Phase C dependencies are clear.
2. **Inline execution** — execute tasks in this session using `skill://executing-plans`, batch execution with checkpoints.
