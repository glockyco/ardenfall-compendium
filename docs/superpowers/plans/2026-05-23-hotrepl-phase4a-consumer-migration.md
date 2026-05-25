# HotRepl Phase 4a Consumer Migration Implementation Plan

> **Status:** Completed on 2026-05-24. Spec, mechanical API migration, build,
> mod-tests, live HotRepl smoke against the running game, and closeout docs are
> all green (commits `e783cc7`, `ffe6b47`, `045ece8`). Treat the task boxes
> below as historical execution notes, not pending work.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile and live-check Ardenfall's typed HotRepl commands against the Phase 4a HotRepl authoring API.

**Architecture:** This is a mechanical API cutover. Command metadata, DTOs, artifacts, and wire protocol behavior stay unchanged; only C# authoring API names and helper delegation change.

**Tech Stack:** C# BepInEx/Mono mod, HotRepl.Core v2 control protocol, Bun controller scripts, live HotRepl WebSocket checks.

---

## Task 1: Record migration spec

**Files:**

- Create: `docs/superpowers/specs/2026-05-23-hotrepl-phase4a-consumer-migration.md`

- [ ] **Step 1: Write the spec**

Capture the stable command contract, the Phase 4a API deltas, the decision not to change artifact ownership, and the required build/live checks.

- [ ] **Step 2: Commit the spec**

Run:

```bash
git add docs/superpowers/specs/2026-05-23-hotrepl-phase4a-consumer-migration.md docs/superpowers/plans/2026-05-23-hotrepl-phase4a-consumer-migration.md
git commit -F .git/COMMIT_EDITMSG_omp
```

Expected: spec and plan only are committed.

## Task 2: Apply mechanical command API migration

**Files:**

- Modify: `mod/src/Control/CompendiumCommandResults.cs`
- Modify: `mod/src/Control/Handlers/*.cs`

- [ ] **Step 1: Rename command kind enum values**

Replace every `ControlCommandKind.Synchronous` in the command handlers with `ControlCommandKind.Sync`.

- [ ] **Step 2: Type command contexts**

For each `ExecuteAsync` method, change `ControlCommandContext context` to `ControlCommandContext<TOutput> context`, using the handler's declared output type.

- [ ] **Step 3: Delegate failures through context helpers**

Change `CompendiumCommandResults.Validation`, `Precondition`, and `RequiredString` to accept `ControlCommandContext<TOutput> context` and return `context.ValidationFailed(...)` or `context.PreconditionFailed(...)`. Pass `context` from all handler call sites, including nested validation helpers.

- [ ] **Step 4: Build**

Run:

```bash
scripts/with-env.sh bash -c ': "${ARDENFALL_MANAGED_DIR:?set ARDENFALL_MANAGED_DIR}"; mod/scripts/copy-libs.sh "$ARDENFALL_MANAGED_DIR" /Users/joaichberger/Projects/HotRepl/src/HotRepl.Core/bin/Debug/netstandard2.1 && dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q'
```

Expected: build succeeds with 0 errors.

- [ ] **Step 5: Commit the migration**

Run:

```bash
git add mod/src/Control/CompendiumCommandResults.cs mod/src/Control/Handlers/*.cs
git commit -F .git/COMMIT_EDITMSG_omp
```

Expected: only HotRepl migration files are committed.

## Task 3: Run live HotRepl checks

**Files:** none unless a live check exposes a real migration defect.

- [ ] **Step 1: Deploy and launch if needed**

Use the existing Ardenfall `hotrepl:setup` and `hotrepl:launch` scripts when the running game does not already expose the updated plugin.

- [ ] **Step 2: Verify control-plane readiness**

Connect to `ws://127.0.0.1:18590` with the HotRepl CLI and verify protocol v2, command catalog registration, `compendium.info`, and `compendium.preflight`.

Expected: command calls return typed command results or domain diagnostics, not `unknown_command`, protocol errors, or missing-method failures.
