# Slice 1.5 — Stabilisation, Deployment, and Operational Hygiene

Date: 2026-05-07
Status: Ready
Spec coverage: `docs/superpowers/specs/2026-05-07-investment-priorities.md` §3 (foundation hygiene before breadth); `docs/superpowers/specs/2026-04-28-ardenfall-archives-design.md` §16 open question 1 (deployment).
Predecessor: `docs/superpowers/plans/2026-05-03-item-walking-skeleton.md` (Slice 1, complete).
Worktree branch (suggested): `slice/1.5-stabilisation` off `main`.

## Goal

Close the loose ends from Slice 1 before Slice 2 multiplies their cost. Specifically:

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
- No deployment-time secrets management in the initial local/operator deploy path. Wrangler uses the operator's local Cloudflare login, matching the Ancient Kingdoms setup. If a later CI deploy is required, that later plan must explicitly choose GitHub Action credentials/secrets.
- No deployment-time pivot beyond the Cloudflare adapter needed for `wrangler deploy`; the site remains an SPA shell (`ssr=false`, `prerender=false`) unless a later slice chooses SSR.

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
**Fix:** the walker runs once per run, the produced rows are cached on `ArchiveRun`, and `entity.exportBatch` reads `Take(offset, limit)` from the cached list. The natural owner is a new `ItemExtractionService` that `entity.plan` invokes (lazily) and stores on the run; subsequent commands reuse it.

### B4 — Walker-level diagnostics dropped between batches

**Same files as B2/B3.**
**Symptom:** each `new ItemExtractor()` accumulates `Diagnostics` (including `Refs.Diagnostics` from ref-resolution failures; today this includes the 898 `lookupAssetGuidMissing` references that resolve to per-row diagnostics, but in general also includes failures that aren't bound to any specific row). The extractor instance is GC'd after the chunk slice is written; its walker-level `Diagnostics` go nowhere.
**Fix:** caching the rows on `ArchiveRun` (B3 fix) also caches walker-level `Diagnostics` and `Refs.Diagnostics`. `RunFinalizeCommand` reads them and aggregates into the manifest totals (B1 fix) plus emits a `diagnostics.json` sibling if non-empty.

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

Phases run sequentially because the bug fixes share refactor surface. Within a phase, tasks parallelise where indicated.

### Phase A — C# test project foundation

Without a C# test project for the mod, none of the bug fixes can be verified except by live smoke. Slice 1.5 adds the test project so future slices have a real regression substrate.

#### Task A.1 — Create `mod-tests/ArdenfallArchives.Tests.csproj`

**Files:**

- Create: `mod-tests/ArdenfallArchives.Tests.csproj`
- Create: `mod-tests/.gitignore` (entries for `bin/`, `obj/`)
- Modify: `AncientKingdomsMods.sln` is a sibling-project artifact and is **not** the Ardenfall solution; check whether `ardenfall-archives` has its own `.sln` or is dotnet-build'd via `mod/ArdenfallArchives.csproj` directly. If no solution file exists, the test project is built standalone via `dotnet test mod-tests/ArdenfallArchives.Tests.csproj`.

- [ ] **Step 1: Decide framework.** Use `xunit` 2.9+ with `xunit.runner.visualstudio`. xUnit is the dotnet-ecosystem default and integrates cleanly with `dotnet test`. Target `net8.0` for the test project (test runner does not need to match the mod's `netstandard2.1`); the test project references the mod's source by `<ProjectReference Include="..\mod\ArdenfallArchives.csproj"/>` so test code can call mod types directly.

- [ ] **Step 2: Write the csproj.**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
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
    <ProjectReference Include="..\mod\ArdenfallArchives.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 3: Add a smoke test.**

```csharp
// mod-tests/SmokeTests.cs
using Xunit;

namespace ArdenfallArchives.Tests;

public sealed class SmokeTests
{
    [Fact]
    public void TestProjectLinksMod() => Assert.Equal("ArdenfallArchives", typeof(ArdenfallArchives.Plugin).Assembly.GetName().Name);
}
```

- [ ] **Step 4: Verify build + run.**

```sh
dotnet test mod-tests/ArdenfallArchives.Tests.csproj
```

Expected: `Passed: 1, Failed: 0`. The test project must build without `mod/libs/Assembly-CSharp.dll`-resolving code paths — the smoke test only touches `Plugin.Version` static and `Application.version`-free types; no Unity types are loaded.

- [ ] **Step 5: Update CI.** Add a `mod-tests` job to `.github/workflows/ci.yml` that runs after the `mod` (format-check) job, calling `dotnet test mod-tests/ArdenfallArchives.Tests.csproj`. Path-filter on `mod/**` and `mod-tests/**`.

- [ ] **Step 6: Commit.**

```sh
git add mod-tests/ .github/workflows/ci.yml
git commit -m "test(mod): bootstrap xunit test project for ArdenfallArchives"
```

**Phase A gate:** `dotnet test mod-tests/ArdenfallArchives.Tests.csproj` passes locally. New CI job is wired and runs against the smoke test.

### Phase B — Refactor for testability + cache rows on the run

#### Task B.1 — Extract `ItemExtractionService`

**Files:**

- Create: `mod/src/Extraction/ItemExtractionService.cs`
- Modify: `mod/src/Control/ArchiveRun.cs`

The current `EntityPlanCommand` and `EntityExportBatchCommand` both call `new ItemExtractor().Walk()` directly. The fix is to make extraction a one-time-per-run operation owned by a service that caches its result on the run.

- [ ] **Step 1: Write the failing test.** In `mod-tests/ItemExtractionServiceTests.cs`, write a test that asserts `ItemExtractionService.GetOrExtract(run)` returns the same `IReadOnlyList<ItemSnapshotRow>` instance on the second call (reference equality), proving that re-walking does not happen. The test substitutes a fake `IItemAssetSource` that counts how many times it is enumerated; the assertion is `assetSource.WalkCount == 1` after two `GetOrExtract` calls.

```csharp
// mod-tests/ItemExtractionServiceTests.cs
using ArdenfallArchives.Control;
using ArdenfallArchives.Entities.Item;
using ArdenfallArchives.Extraction;
using Xunit;

public sealed class ItemExtractionServiceTests
{
    [Fact]
    public void Caches_rows_after_first_walk()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var run = new ArchiveRun { RunId = "test" };

        var first = service.GetOrExtract(run);
        var second = service.GetOrExtract(run);

        Assert.Same(first, second);
        Assert.Equal(1, source.WalkCount);
    }
}
```

`CountingItemAssetSource` is a fake implementing the new `IItemAssetSource` interface; for this test it returns an empty enumerable but increments `WalkCount` on each enumeration.

- [ ] **Step 2: Add the `IItemAssetSource` seam.**

```csharp
// mod/src/Entities/Item/IItemAssetSource.cs
namespace ArdenfallArchives.Entities.Item;

public interface IItemAssetSource
{
    System.Collections.Generic.IEnumerable<Ardenfall.Item.ItemData> EnumerateItems();
}
```

The default production implementation:

```csharp
// mod/src/Entities/Item/BuiltLookupTableItemAssetSource.cs
namespace ArdenfallArchives.Entities.Item;

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
using ArdenfallArchives.Control;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Entities.Item;

namespace ArdenfallArchives.Extraction;

public sealed class ItemExtractionService
{
    private readonly IItemAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public ItemExtractionService(IItemAssetSource source) { _source = source; }

    public IReadOnlyList<ItemSnapshotRow> GetOrExtract(ArchiveRun run)
        => GetState(run).Rows;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(ArchiveRun run)
        => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(ArchiveRun run)
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

The service is instantiated once at plugin startup and registered with the same DI surface the command handlers use today (constructor injection through `ArchiveCommandRegistry`).

- [ ] **Step 4: Update `ArchiveCommandRegistry`** to construct and pass the `ItemExtractionService` to `EntityPlanCommand`, `EntityExportBatchCommand`, and `RunFinalizeCommand`. Verify the smoke test from Phase A still passes (no Unity type loading).

- [ ] **Step 5: Run.**

```sh
dotnet test mod-tests/ArdenfallArchives.Tests.csproj
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

**Phase B gate:** `ItemExtractionServiceTests`, `EntityPlanCommandTests`, and `EntityExportBatchCommandTests` all pass. Walker invocation count is exactly 1 per run regardless of batch count. `dotnet build mod/ArdenfallArchives.csproj` exits 0/0/0; `dotnet format mod/ArdenfallArchives.csproj --verify-no-changes` exits 0.

### Phase C — Diagnostic-counting fix

#### Task C.1 — Aggregate per-row + walker-level diagnostics in `RunFinalizeCommand`

**Files:**

- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Modify: `mod-tests/RunFinalizeCommandTests.cs` (new)
- Modify: `mod/src/Emit/ManifestBuilder.cs` if helper methods are added

- [ ] **Step 1: Write the failing test.** Set up a workspace dir with a chunks dir containing two chunks: chunk A has one row with two `diagnostic`-severity diagnostics, chunk B has one row with one `fatal` diagnostic. Walker-level diagnostics list contains one `diagnostic`. Invoke `RunFinalizeCommand.ExecuteAsync`. Assert the published manifest has `diagnostics: { fatal: 1, diagnostic: 3 }`. Assert a `diagnostics.json` sibling exists with all four entries.

- [ ] **Step 2: Refactor.** `RunFinalizeCommand`:
  1. Reads chunk JSONs as today.
  2. Aggregates per-row diagnostics across all chunks into a `DiagnosticTotals`.
  3. Adds walker-level diagnostics from `service.GetWalkerDiagnostics(run)` to the totals.
  4. Writes `diagnostics.json` next to `items.json` if any diagnostics exist (per-row + walker-level entries combined into one stream, each tagged with its source: `"rowId"` for per-row, `null` for walker-level).
  5. Passes the aggregated totals to `ManifestBuilder.Build`.

- [ ] **Step 3: Update the snapshot schema** (`schemas/snapshot.schema.json`) to accept the new optional `diagnostics.json` artifact. Update `pipeline/src/stages/load-snapshot.ts` to read it if present and surface the entries. Update the validate stage to count them if applicable. Regenerate validators.

- [ ] **Step 4: Run.**

```sh
dotnet test mod-tests/ArdenfallArchives.Tests.csproj
bun test pipeline/test
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
- Modify: `site/src/routes/items/[id]/+page.ts` (verify error throw shape is consumable by the route)

- [ ] **Step 1: Write a failing visual test.** Add a Playwright (or puppeteer-based) script to `site/test/error-route.spec.ts` that:
  1. Builds the site with `bun run --cwd site build`.
  2. Serves it via `bunx serve build`.
  3. Navigates to `/items/this-id-does-not-exist`.
  4. Asserts the rendered page shows "Item not found" (or equivalent), `status` is 404 visible to the user, and a link back to `/` is present.

  If Playwright is too heavyweight for this slice, use the existing puppeteer pattern documented in the prior handoff and commit a smoke script under `site/scripts/`.

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
bun run --cwd site check
bun run --cwd site build
```

Expected: 0 errors / 0 warnings; build emits successfully. Smoke script (Step 1) passes.

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

#### Task F.1 — HotRepl runtime-eval helper invoked from controller

**Files:**

- Modify: `controller/src/cli.ts` or create `controller/src/wait-for-world.ts`
- Modify: `controller/test/wait-for-world.test.ts` (new)

- [ ] **Step 1: Identify the eval target.** Per Slice 1's progress doc, the game starts in `MainMenu`; clicking the `continue` button loads `world_Ardenfall`. The HotRepl runtime-eval helper finds the continue button (likely a `UnityEngine.UI.Button` with a recognizable name path) and invokes its `onClick` event. Reference: `/Users/joaichberger/Projects/HotRepl/docs/superpowers/specs/...` for the eval surface; the runtime-eval contract takes a string of C# source, compiles it via Mono, and returns the result.

  The helper exposes:

  ```ts
  await waitForWorld(client, { timeoutMs: 60_000 });
  ```

  which, in order:
  1. Polls `archive.preflight`. If it passes immediately (already in world), returns.
  2. If preflight reports `ardenfallGame: not initialized`, eval-runs a snippet that finds the menu's continue button and clicks it.
  3. Polls `archive.preflight` until it passes or `timeoutMs` elapses.
  4. Returns or throws a clear timeout error with the last preflight reason.

- [ ] **Step 2: Write the failing test.** Mock the HotRepl client; assert the helper polls preflight, sends the eval command on first failure, and returns when preflight passes.

- [ ] **Step 3: Implement.** Keep the eval snippet minimal and inspectable; do not embed long C# strings if a typed command would be clearer. (If the eval surface is too brittle, add a typed `archive.continueFromMenu` command to the mod instead — this is the more robust answer and is preferred if eval proves flaky.)

- [ ] **Step 4: Wire into `controller:export`.** The CLI gains `--wait-for-world` (default true for live runs, false in unit tests). The export orchestrator calls `waitForWorld(client, …)` after preflight reports not-ready and before `run.begin`.

- [ ] **Step 5: Run + live-verify.**

```sh
bun test controller/test
# then a live run:
bun run controller:deploy …
bun run controller:export … --wait-for-world
```

Expected: live run succeeds without a human click on `Continue`.

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
- Ardenfall's site remains an SPA (`ssr=false`, `prerender=false`) even under `adapter-cloudflare`; the Worker is primarily the static-asset entrypoint plus routing shell. If a later slice wants SSR/edge code, the adapter is already compatible.

#### Task G.2 — Wire `adapter-cloudflare` + Wrangler deploy

**Files:**

- Modify: `site/package.json` (add `@sveltejs/adapter-cloudflare`, `wrangler`, `cf-deploy`)
- Modify: `site/svelte.config.js` (switch from `adapter-static` to `adapter-cloudflare`)
- Create: `site/wrangler.toml`
- Modify: `site/AGENTS.md` (document deploy and login assumptions)

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
  bun run pipeline:run fixtures/synthetic/snapshot site/static
  bun run --cwd site build
  bun run --cwd site cf-deploy
  ```

  If automated deploys become necessary later, add a separate plan that explicitly chooses the GitHub Actions credential model. Do not smuggle `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` into this slice.

- [ ] **Step 5: Custom domain.** Configure `ardenfall.compendiums.org` as a custom domain/route in the Cloudflare account if Wrangler does not create the route automatically on first deploy. DNS record management lives in the `compendiums.org` umbrella account.

- [ ] **Step 6: Update `site/AGENTS.md`** to document:
  - `bun run --cwd site cf-deploy` is the deploy command.
  - The operator must be logged in with Wrangler (`wrangler login`) or otherwise have a valid Wrangler auth context.
  - CI verifies the deployable build but does not deploy.

- [ ] **Step 7: Verify.** From a Wrangler-authenticated shell, run the deploy commands in Step 4. Verify `https://ardenfall.compendiums.org/items` resolves and renders the synthetic-fixture-derived data. Verify an unknown URL reaches the SPA shell and renders `+error.svelte` after Phase D lands.

- [ ] **Step 8: Commit (per logical chunk).**

  ```sh
  git commit -m "feat(site): cloudflare static assets deploy config"
  git commit -m "docs(site): document wrangler deploy workflow"
  ```

**Phase G gate:** `https://ardenfall.compendiums.org/items` returns the rendered overview page with the deployed SQLite blob's contents. `https://ardenfall.compendiums.org/items/<known-id>` returns the detail page. Unknown URLs hit the SPA shell and render `+error.svelte` with status 404.

## Self-review

### Spec coverage trace

| Deliverable                            | Task     |
| -------------------------------------- | -------- |
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

No `TODO`, `TBD`, "implement later" appear in implementation steps. The two genuine deferrals are explicit: real-fixture curation (Slice 2 trigger), and the `archive.continueFromMenu` typed command (a fallback in Phase F if runtime-eval proves flaky in practice).

### Type / signature consistency

- `IItemAssetSource` is consistent across the production source (`BuiltLookupTableItemAssetSource`), the test fake (`CountingItemAssetSource`), and the consumer (`ItemExtractor`).
- `DiagnosticTotals` shape (`{ fatal, diagnostic }`) matches across `mod/src/Dtos/Manifest.cs`, the new aggregation in `RunFinalizeCommand`, and `pipeline/src/stages/validate.ts`.
- `ArchiveRun.Counts["item"]` semantics: kept as "items written so far" while a run is open; replaced with the cached row count on finalize.

### Known risks remaining

1. **Runtime-eval brittleness for `wait-for-world`.** If Mono runtime-eval through HotRepl is fragile against the menu's UnityEngine.UI hierarchy (renames, dynamic instantiation), the helper falls back to a typed `archive.continueFromMenu` command on the mod side. This decision is made in Task F.1 Step 1 once the eval target is identified.
2. **Cloudflare Workers/Static Assets free tier limits.** Slice 1.5 has local/operator deploys only; CI does not deploy. If a later slice introduces automated deploys or preview deploys per PR, monitor Worker and build limits then.
3. **Synthetic-fixture-derived deploy.** Until a real snapshot is archived externally and copied into CI, the deployed site only knows the 2 synthetic items. This is acceptable for Slice 1.5 (deployment exists; content thinness is real but not a deployment defect) and is fixed in Slice 13 (versioning + snapshot archive).

### Execution handoff

Plan complete. Two execution options:

1. **Subagent-driven** — dispatch a fresh subagent per task; review between tasks; fast iteration. Best fit for this slice.
2. **Inline execution** — execute tasks in this session using `skill://superpowers:executing-plans`; batch execution with checkpoints.

Phases A → B → C are sequential because they share refactor surface; Phases D, E, F, G can parallelise across separate subagents once Phase C is in.
