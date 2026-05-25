# HotRepl Export Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** Completed on 2026-05-21. The implementation landed in
> `fe82c8f`, `54b1049`, and `01e1dc6`: game-side finalize now verifies
> preflight and complete chunk state before atomic publish; the controller
> validates every snapshot artifact, hash, count, and fatal diagnostic before
> running the pipeline; setup/export helper scripts are in place. Treat the
> task boxes below as historical execution notes, not pending work.

**Goal:** Make the Ardenfall HotRepl export path publish only complete, preflight-passing snapshots and validate every emitted artifact before pipeline ingestion.

**Architecture:** The game-side run owns a persisted plan and completed chunk ledger under `<base>/runs/<runId>/control/run.json`; `run.finalize` reruns preflight, verifies the item plan is complete, writes into a staging directory, and publishes with a single rename. The controller treats the published manifest as authoritative and validates all files, hashes, counts, and fatal diagnostics before invoking the pipeline.

**Tech Stack:** C# netstandard2.1 BepInEx mod command handlers with xUnit tests; Bun TypeScript controller with Bun tests; Bash setup helper scripts.

---

### Task 1: Game-side finalize safety

**Files:**

- Modify: `mod-tests/RunFinalizeCommandTests.cs`
- Modify: `mod/src/Control/CompendiumRun.cs`
- Modify: `mod/src/Control/CompendiumRunManager.cs`
- Modify: `mod/src/Control/Handlers/EntityPlanCommand.cs`
- Modify: `mod/src/Control/Handlers/EntityExportBatchCommand.cs`
- Modify: `mod/src/Control/Handlers/RunFinalizeCommand.cs`

- [ ] **Step 1: Add failing tests for finalize gates**

Add tests that prove `run.finalize` rejects failed preflight without creating `<base>/snapshots`, rejects missing planned chunks without publishing, and removes staging output if a writer dependency throws before publish.

- [ ] **Step 2: Run the focused finalize tests and verify RED**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "FullyQualifiedName~RunFinalizeCommandTests"`
Expected: at least one new assertion fails against current direct-publish behavior.

- [ ] **Step 3: Implement persisted run plan and completed chunk state**

Add an item plan to `CompendiumRun`, persist `control/run.json` from `CompendiumRunManager`, set the plan in `entity.plan`, and mark completed offsets in `entity.exportBatch` after chunk write succeeds.

- [ ] **Step 4: Implement preflight-gated atomic finalize**

Inject a preflight runner into `RunFinalizeCommand` for tests, return a precondition error when preflight fails, verify all expected item chunk offsets exist before writing, write all published files under `.staging-<gameVersion>-<runId>`, and publish with `Directory.Move` to `<base>/snapshots/<gameVersion>-<runId>` only after manifest/artifacts are complete.

- [ ] **Step 5: Run focused mod tests and verify GREEN**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "FullyQualifiedName~RunFinalizeCommandTests|FullyQualifiedName~EntityPlanCommandTests|FullyQualifiedName~EntityExportBatchCommandTests"`
Expected: all selected tests pass.

### Task 2: Controller manifest validation

**Files:**

- Modify: `controller/test/export-orchestrator.test.ts`
- Modify: `controller/src/validate-snapshot.ts`

- [ ] **Step 1: Add failing validation tests**

Add tests that build a complete manifest with `items.json`, `stat-types.json`, `item-categories.json`, `item-tags.json`, `asset-manifest.json`, `master-tooltip.json`, and optional `diagnostics.json`, then assert success includes all entity counts. Add negative tests for a missing manifest artifact, mismatched non-item hash, mismatched non-item row count, malformed diagnostics, and fatal diagnostics.

- [ ] **Step 2: Run controller tests and verify RED**

Run: `bun test controller/test/export-orchestrator.test.ts`
Expected: at least one new validation test fails because only `items.json` is currently checked.

- [ ] **Step 3: Expand snapshot validation**

Read manifest hashes, require every hashed file to exist, verify sha256 for every hashed file, validate `rows` arrays and manifest counts for each known entity envelope, validate diagnostics is an array when present, reject fatal diagnostics, and return counts for item, stat-type, item-category, and item-tag.

- [ ] **Step 4: Run controller tests and verify GREEN**

Run: `bun test controller/test/export-orchestrator.test.ts`
Expected: all tests in the file pass.

### Task 3: Portable setup contract

**Files:**

- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `mod/scripts/copy-libs.sh`
- Modify: `README.md`

- [ ] **Step 1: Add setup config and scripts**

Add `.env.example` with local paths and token variable names, ignore `.env`, add package scripts for HotRepl build, mod copy-libs, mod build, deploy, and export smoke commands, and document the variable contract in `README.md`.

- [ ] **Step 2: Make copy-libs fail fast**

Update `mod/scripts/copy-libs.sh` so missing managed DLLs or `HotRepl.Core.dll` produce a clear error and non-zero exit instead of silently skipping HotRepl.

- [ ] **Step 3: Verify setup helper behavior**

Run the script against a temporary managed directory with a missing HotRepl output and verify it fails with a HotRepl-specific error. Run the script against the local configured game managed directory and HotRepl output and verify it copies the expected DLL set.

### Task 4: Final verification

**Files:**

- No additional files.

- [ ] **Step 1: Run mod build**

Run: `dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q`
Expected: 0 warnings and 0 errors.

- [ ] **Step 2: Run focused mod tests**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "FullyQualifiedName~RunFinalizeCommandTests|FullyQualifiedName~EntityPlanCommandTests|FullyQualifiedName~EntityExportBatchCommandTests|FullyQualifiedName~ItemExtractionServiceTests"`
Expected: all selected tests pass.

- [ ] **Step 3: Run controller tests**

Run: `bun run controller:test`
Expected: all controller tests pass.

- [ ] **Step 4: Run formatting and diff checks**

Run: `git diff --check`
Expected: no whitespace errors.
