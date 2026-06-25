---
title: "HotRepl Phase 4a Consumer Migration Specification"
type: spec
status: implemented
created: 2026-05-23
parent:
superseded_by:
archived: 2026-06-25
---

# HotRepl Phase 4a Consumer Migration Specification

**Status:** Implemented and live-checked on 2026-05-23 (commits `e783cc7`, `ffe6b47`).
**Date:** 2026-05-23
**Scope:** Migrate Ardenfall's BepInEx typed-command consumer to the Phase 4a HotRepl authoring API and verify it against the current local HotRepl core.

## Goal

Ardenfall continues to compile and run its typed command catalog against the current HotRepl core after the Phase 4a clean cutover. The wire protocol remains v2 and the exported command names, arguments, outputs, and artifact keys stay unchanged.

## Required API shape

HotRepl Phase 4a changes the C# authoring API in three relevant ways:

- `ControlCommandKind.Synchronous` is now `ControlCommandKind.Sync`.
- `IControlCommandHandler<TArgs, TOutput>.ExecuteAsync` receives `ControlCommandContext<TOutput>` instead of the non-generic context.
- Static failure factories on `ControlCommandResult` are removed; typed handlers use `context.ValidationFailed(...)` and `context.PreconditionFailed(...)`.

Ardenfall's command helpers remain a local convenience layer, but they must delegate to the typed context helpers rather than recreating removed HotRepl factories.

## Migration design

The migration is mechanical and intentionally narrow. Each command handler keeps the same command name, version, kind, mutability flag, argument DTO, output DTO, and artifact map. The only source changes are the enum rename, the generic context parameter, and passing that typed context through `CompendiumCommandResults` validation helpers.

Artifact production remains unchanged. Ardenfall already writes snapshot files itself and returns `ArtifactRef` maps through `ControlCommandResult.Ok(output, artifacts)`, which is still supported by the Phase 4a API. The migration does not switch snapshot writing to `IArtifactWriter`; that would change artifact ownership and belongs in a separate design if needed.

## Verification contract

A valid migration must pass all of the following:

1. `dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q` against the current local HotRepl core output.
2. A live HotRepl control-plane check against the running Ardenfall game that confirms:
   - the server handshakes with `protocolVersion: 2`,
   - the command catalog contains the Ardenfall typed commands,
   - `compendium.info` succeeds,
   - `compendium.preflight` returns a typed command result or a domain precondition/validation result from the migrated API rather than a protocol failure.

## Commit strategy

Commit the spec separately from the code migration. Commit only the HotRepl migration files and leave unrelated existing working-tree edits untouched.
