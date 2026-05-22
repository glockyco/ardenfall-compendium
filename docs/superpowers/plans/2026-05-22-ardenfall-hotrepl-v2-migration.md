# Ardenfall HotRepl v2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Ardenfall export controller and mod command bridge from the bespoke HotRepl v1 client to the canonical HotRepl v2 SDK and runtime protocol.

**Architecture:** The C# mod keeps owning game-specific extraction commands, but emits v2 descriptors and result envelopes through HotRepl's public protocol/runtime command API. The TypeScript controller deletes its raw WebSocket client and talks only through a small `CompendiumClient` facade over `@hotrepl/sdk`; orchestration remains responsible for export phases, snapshot validation, and pipeline launch.

**Tech Stack:** Bun 1.3.x, TypeScript 6, `@hotrepl/sdk`, `@hotrepl/testing`, BepInEx/Mono C# `netstandard2.1`, xUnit, existing schema validators under `schemas/` and `pipeline/dist/`.

---

## Preconditions

- Implement from the isolated worktree `ardenfall-compendium/.worktrees/hotrepl-v2-migration-plan` or a fresh successor worktree, not from `main`.
- Run `git status --short --branch` before editing. The source checkout had unrelated user edits when this plan was written.
- HotRepl v2 packages must be available to Bun as `@hotrepl/sdk` and `@hotrepl/testing`. If they are not published yet, stop and choose one explicit package source for this repo before Task 2; do not commit machine-local absolute `file:` dependencies.
- Do not add Python. This repo currently uses Bun/TypeScript for the controller and C# for the mod.
- HotRepl v2 has no `control_auth`, `lease_acquire`, `sessionId`, `leaseId`, `command_error`, `job_result` client request, profile, ping, or token compatibility.

---

## File Structure

`mod/src/Control/` after migration:

```text
mod/src/Control/
  CompendiumCommandRegistry.cs      # registers v2 command handlers
  CompendiumCommandResults.cs       # output DTOs, diagnostic DTOs, artifact DTOs
  CompendiumCommandSchemas.cs       # JSON schemas using v2 input/output names
  Handlers/
    CompendiumInfoCommand.cs
    CompendiumPreflightCommand.cs
    ContinueFromMenuCommand.cs
    RunBeginCommand.cs
    RunStatusCommand.cs
    EntityPlanCommand.cs
    EntityExportBatchCommand.cs
    RunFinalizeCommand.cs
    RunDiscardCommand.cs
    GameQuitCommand.cs
```

`controller/src/` after migration:

```text
controller/src/
  compendium-client.ts              # SDK-backed facade; owns command names and result parsing
  cli.ts                            # export CLI; no --token
  export-orchestrator.ts            # phase choreography over CompendiumClient
  wait-for-world.ts                 # uses CompendiumClient.continueFromMenu()
  deploy.ts                         # deploys plugins/config without v1 Control auth settings
  validate-snapshot.ts              # keeps snapshot artifact contract validation
```

Deletes:

```text
controller/src/hotrepl-client.ts
controller/test/hotrepl-client.test.ts
```

Generated schema files stay where they are: sources in `schemas/*.schema.json`, generated validators in `pipeline/dist/validate-*.mjs` and `pipeline/dist/validate-*.d.mts`.

---

## Task 1: Cut the mod command surface to HotRepl v2

**Files:**

- Modify: `mod/ArdenfallCompendium.csproj`
- Modify: `mod-tests/ArdenfallCompendium.Tests.csproj`
- Modify: `mod/src/Plugin.cs`
- Modify: `mod/src/Control/CompendiumCommandRegistry.cs`
- Modify: `mod/src/Control/CompendiumCommandResults.cs`
- Modify: `mod/src/Control/CompendiumCommandSchemas.cs`
- Modify: `mod/src/Control/Handlers/*.cs`
- Modify: `mod-tests/EntityPlanCommandTests.cs`
- Modify: `mod-tests/EntityExportBatchCommandTests.cs`
- Modify: `mod-tests/RunFinalizeCommandTests.cs`
- Modify: `mod/AGENTS.md`

- [ ] **Step 1: Write failing v2 descriptor/result tests**

Update focused command tests so they assert v2 names and output shape:

```csharp
Assert.Equal("entity.exportBatch", descriptor.Name);
Assert.Equal(1, descriptor.MajorVersion);
Assert.Equal("job", descriptor.Kind);
Assert.NotNull(descriptor.InputSchema);
Assert.NotNull(descriptor.OutputSchema);
Assert.NotNull(descriptor.ArtifactsSchema);

var result = await handler.ExecuteAsync(args, CancellationToken.None);
Assert.Equal("ok", result.Status);
Assert.NotNull(result.Output);
Assert.DoesNotContain(result.GetType().GetProperties(), p => p.Name == "Result");
```

Add a failure assertion for command errors:

```csharp
Assert.Equal("failed", result.Status);
Assert.Equal("validation_failed", result.Error!.Kind);
Assert.False(result.Error.Retryable);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```sh
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "FullyQualifiedName~RunFinalizeCommandTests|FullyQualifiedName~EntityPlanCommandTests|FullyQualifiedName~EntityExportBatchCommandTests"
```

Expected: FAIL because the mod still references v1 `HotRepl.Control` names (`ControlCommandDescriptor.Version`, `argsSchema`, `resultSchema`, array artifacts, `ControlCommandError`, or v1 registry types).

- [ ] **Step 3: Update C# references and DTO names**

Move every command handler from v1 control names to the v2 runtime command API exposed by the HotRepl branch. The long-lived DTO vocabulary in Ardenfall must be:

```csharp
public sealed record CompendiumCommandOutput(
    object? Output,
    IReadOnlyDictionary<string, ArtifactRef> Artifacts,
    IReadOnlyList<CompendiumDiagnostic> Diagnostics);

public sealed record CompendiumDiagnostic(
    string Kind,
    string Code,
    string Message,
    bool Retryable,
    object? Details = null);
```

Descriptor fields must serialize as:

```json
{
  "name": "entity.exportBatch",
  "majorVersion": 1,
  "kind": "job",
  "mutatesState": false,
  "inputSchema": {},
  "outputSchema": {},
  "artifactsSchema": {}
}
```

Do not preserve aliases for `version`, `argsSchema`, `resultSchema`, `result`, `diagnostics` as a top-level response field, `leaseId`, or `idempotencyKey`.

- [ ] **Step 4: Preserve command inventory**

Keep these command names and versions exactly:

```text
compendium.info v1 sync
compendium.preflight v1 sync
compendium.continueFromMenu v1 sync
run.begin v1 sync
run.status v1 sync
entity.plan v1 sync
entity.exportBatch v1 job
run.finalize v1 sync
run.discard v1 sync
game.quit v1 sync
```

`entity.exportBatch` remains a job command. In v2, the SDK receives its terminal `job_result` from `job_status`; no consumer should send `job_result` manually.

- [ ] **Step 5: Run mod verification**

Run:

```sh
dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q --filter "FullyQualifiedName~RunFinalizeCommandTests|FullyQualifiedName~EntityPlanCommandTests|FullyQualifiedName~EntityExportBatchCommandTests"
```

Expected: PASS with zero warnings.

- [ ] **Step 6: Commit**

```sh
git add mod/ArdenfallCompendium.csproj mod-tests/ArdenfallCompendium.Tests.csproj mod/src/Plugin.cs mod/src/Control mod-tests/EntityPlanCommandTests.cs mod-tests/EntityExportBatchCommandTests.cs mod-tests/RunFinalizeCommandTests.cs mod/AGENTS.md
git commit -m "feat(mod): emit HotRepl v2 command contracts"
```

---

## Task 2: Add an SDK-backed `CompendiumClient`

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`
- Create: `controller/src/compendium-client.ts`
- Create: `controller/test/compendium-client.test.ts`

- [ ] **Step 1: Add SDK tests first**

Create `controller/test/compendium-client.test.ts` using `FakeRuntime` and `MockSession` from `@hotrepl/testing`. Cover:

```ts
import { FakeRuntime, MockSession } from "@hotrepl/testing";
import { describe, expect, test } from "bun:test";
import { CompendiumClient } from "../src/compendium-client";

test("validates required command descriptors", async () => {
  const runtime = new FakeRuntime();
  registerArdenfallCommands(runtime);
  const client = new CompendiumClient(await MockSession.create(runtime));
  await expect(client.assertReady({ noQuit: false, waitForWorld: true })).resolves.toBeUndefined();
});

test("waits for exportBatch terminal job result through the SDK", async () => {
  const runtime = new FakeRuntime();
  registerArdenfallCommands(runtime);
  const client = new CompendiumClient(await MockSession.create(runtime));
  const result = await client.exportBatch({ runId: "run-1", entity: "item", offset: 0, limit: 2 });
  expect(result.output).toEqual({ exported: 2 });
});
```

Also cover a missing command, unsupported major version, failed command error envelope, and artifact map parsing.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```sh
bun test controller/test/compendium-client.test.ts
```

Expected: FAIL because `controller/src/compendium-client.ts` does not exist and SDK dependencies are absent.

- [ ] **Step 3: Add HotRepl package dependencies**

HotRepl currently marks the TypeScript packages private. Do not start this implementation task until
the HotRepl repo has made `@hotrepl/sdk` and `@hotrepl/testing` consumable through the package source
chosen for downstream repos.

After that package source exists, add these two dependencies with the exact committed version or
source string from the HotRepl release:

```text
@hotrepl/sdk
@hotrepl/testing
```

Do not commit local absolute `file:` paths or a temporary package source that cannot work on another
machine.

Run:

```sh
bun install --frozen-lockfile
```

If the lockfile is intentionally changing because dependencies were added, run `bun install` once, then rerun `bun install --frozen-lockfile`.

- [ ] **Step 4: Implement the facade**

`controller/src/compendium-client.ts` owns all command names and maps SDK results to controller DTOs:

```ts
import type { Artifact, Result, Session } from "@hotrepl/sdk";

export interface ExportBatchArgs {
  runId: string;
  entity: "item";
  offset: number;
  limit: number;
}

export class CompendiumClient {
  constructor(readonly session: Session) {}

  async assertReady(options: { noQuit: boolean; waitForWorld: boolean }): Promise<void>;
  async preflight(): Promise<Result<Record<string, unknown>>>;
  async continueFromMenu(): Promise<Result<Record<string, unknown>>>;
  async beginRun(outputBaseDir: string): Promise<string>;
  async planEntity(runId: string, entity: "item"): Promise<{ total: number; batchSize: number }>;
  async exportBatch(args: ExportBatchArgs): Promise<Result<Record<string, unknown>>>;
  async finalizeRun(
    runId: string,
  ): Promise<{ publishedDir: string; artifacts: Record<string, Artifact> }>;
  async discardRun(runId: string): Promise<void>;
  async quitGame(): Promise<void>;
}
```

Implementation rules:

- Use `session.describeCommand(name)` for exact command validation; cache is handled by the SDK.
- Use `session.run(name, args)` for both sync and job commands.
- Read command outputs from `result.output`, not `result.result`.
- Treat artifacts as a named map (`result.artifacts.manifest`, `result.artifacts.items`, etc.).
- Re-throw `HotReplError` unchanged so CLI exit handling can use `error.kind`.

- [ ] **Step 5: Run facade tests**

Run:

```sh
bun test controller/test/compendium-client.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add package.json bun.lock controller/src/compendium-client.ts controller/test/compendium-client.test.ts
git commit -m "feat(controller): add HotRepl v2 compendium client"
```

---

## Task 3: Replace controller orchestration and delete the v1 client

**Files:**

- Modify: `controller/src/export-orchestrator.ts`
- Modify: `controller/src/wait-for-world.ts`
- Modify: `controller/src/cli.ts`
- Modify: `controller/src/deploy.ts`
- Modify: `controller/test/export-orchestrator.test.ts`
- Modify: `controller/test/wait-for-world.test.ts`
- Modify: `controller/test/deploy.test.ts`
- Delete: `controller/src/hotrepl-client.ts`
- Delete: `controller/test/hotrepl-client.test.ts`

- [ ] **Step 1: Rewrite tests around `CompendiumClient`**

Update orchestrator tests so they expect no auth or lease phase:

```ts
expect(events.map((event) => event.phase)).toEqual([
  "connect",
  "preflight",
  "run",
  "entity.exportBatch",
  "validate",
  "pipeline",
  "game.quit",
]);
```

Update CLI tests so `--token` is rejected and default URL falls back to `ws://127.0.0.1:18590` when `HOTREPL_URL` is unset.

Update deploy tests so generated `BepInEx/config/hotrepl.bepinex.cfg` contains bind settings only and does not contain `[Control]`, `RequireAuth`, or `AuthToken`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```sh
bun test controller/test/export-orchestrator.test.ts controller/test/wait-for-world.test.ts controller/test/deploy.test.ts
```

Expected: FAIL because production still calls `authenticate()`, `acquireLease()`, v1 `jobResult()`, and token deploy settings.

- [ ] **Step 3: Update orchestration**

`exportCompendium` accepts `client: CompendiumClient` and performs:

```text
connect -> assertReady -> waitForWorld or preflight -> run.begin -> entity.plan -> entity.exportBatch -> run.finalize -> validate -> pipeline -> game.quit
```

Rules:

- Remove `token`, `clientName`, `authenticate`, `acquireLease`, and `lease` logging.
- Replace `startJob` + `jobStatus` + `jobResult` with `await client.exportBatch(...)`.
- Keep best-effort `game.quit`; its failure still logs and must not mask export failure.
- Keep `compendium.continueFromMenu` optional when `waitForWorld` is false.

- [ ] **Step 4: Update CLI and deploy**

`controller/src/cli.ts` should create a session with the SDK:

```ts
import { connect } from "@hotrepl/sdk";
import { CompendiumClient } from "./compendium-client";

const session = await connect({ url: options.url ?? process.env.HOTREPL_URL });
const client = new CompendiumClient(session);
```

Remove `--token` and `HOTREPL_TOKEN` from `controller/src/cli.ts`, `controller/src/deploy.ts`, `package.json` scripts, `.env.example`, and README snippets.

- [ ] **Step 5: Delete v1 client files**

Remove:

```sh
git rm controller/src/hotrepl-client.ts controller/test/hotrepl-client.test.ts
```

- [ ] **Step 6: Run controller verification**

Run:

```sh
bun test controller/test/compendium-client.test.ts controller/test/export-orchestrator.test.ts controller/test/wait-for-world.test.ts controller/test/deploy.test.ts
bun run controller:test
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add controller package.json .env.example README.md
git commit -m "feat(controller): switch export flow to HotRepl v2"
```

---

## Task 4: Preserve snapshot validation and generated schemas

**Files:**

- Modify: `controller/src/validate-snapshot.ts`
- Modify: `schemas/*.schema.json` only if a published snapshot file changes
- Modify: `pipeline/dist/validate-*.mjs` and `pipeline/dist/validate-*.d.mts` only through codegen
- Modify: `controller/test/export-orchestrator.test.ts`
- Modify: `tooling.test.ts`

- [ ] **Step 1: Add artifact validation tests**

Add tests proving `run.finalize` output and named artifacts are both validated before the pipeline runs:

```ts
expect(finalizeResult.output.publishedDir).toContain("snapshots");
expect(Object.keys(finalizeResult.artifacts)).toEqual([
  "manifest",
  "items",
  "statTypes",
  "itemCategories",
  "itemTags",
  "assetManifest",
  "masterTooltip",
]);
```

- [ ] **Step 2: Run tests to verify they fail if artifacts are ignored**

Run:

```sh
bun test controller/test/export-orchestrator.test.ts
```

Expected: FAIL until the orchestrator checks named artifact references or the test fake exposes them through `CompendiumClient`.

- [ ] **Step 3: Keep schema generation source-of-truth unchanged**

If snapshot JSON shape changes, edit source schemas under `schemas/` and regenerate validators:

```sh
bun run codegen:validators
```

Do not hand-edit `pipeline/dist/validate-*.mjs`.

- [ ] **Step 4: Run schema and tooling checks**

Run:

```sh
bun run codegen:validators
bun test tooling.test.ts
```

Expected: PASS and no unexpected validator diffs.

- [ ] **Step 5: Commit**

```sh
git add controller/src/validate-snapshot.ts controller/test/export-orchestrator.test.ts schemas pipeline/dist tooling.test.ts
git commit -m "test(controller): verify HotRepl artifact contract"
```

---

## Task 5: Update docs, setup, and live verification

**Files:**

- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-05-06-hotrepl-export-workflow-design.md`
- Modify: `mod/scripts/copy-libs.sh`
- Modify: `mod/AGENTS.md`
- Modify: `package.json`

- [ ] **Step 1: Remove v1 vocabulary from docs/config**

Search and remove or replace these strings in active docs and scripts:

```text
HOTREPL_TOKEN
--token
control_auth
lease_acquire
leaseId
sessionId
RequireAuth
AuthToken
job_result request
```

The only acceptable mentions are historical notes in this plan or explicit statements that v2 removed the concept.

- [ ] **Step 2: Document v2 setup**

README and `.env.example` should document:

```text
HOTREPL_URL=ws://127.0.0.1:18590
HOTREPL_REPO=/path/to/HotRepl
HOTREPL_BEPINEX_OUT=/path/to/HotRepl/src/HotRepl.BepInEx/bin/Debug/netstandard2.1
ARDENFALL_MANAGED_DIR=/path/to/Ardenfall Demo_Data/Managed
ARDENFALL_PLUGINS_DIR=/path/to/BepInEx/plugins
```

`hotrepl:export` should no longer require `HOTREPL_TOKEN`.

- [ ] **Step 3: Run formatting and static checks**

Run:

```sh
bun run format:check
bun run lint
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run local mod/controller checks**

Run:

```sh
bun install --frozen-lockfile
bun run controller:test
dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q
```

Expected: PASS with zero warnings.

- [ ] **Step 5: Run operator smoke when local game inputs exist**

Run:

```sh
bun run hotrepl:setup
bun run hotrepl:launch
bun run hotrepl:export
```

Expected: export logs complete through `pipeline`, `validateSnapshot` passes, and the pipeline output is refreshed. If the game is unavailable, record the missing local prerequisite in the final commit body; do not claim live export success.

- [ ] **Step 6: Commit**

```sh
git add README.md .env.example docs/superpowers/specs/2026-05-06-hotrepl-export-workflow-design.md mod/scripts/copy-libs.sh mod/AGENTS.md package.json
git commit -m "docs: document Ardenfall HotRepl v2 export flow"
```

---

## Final branch gate

Run before requesting review:

```sh
git status --short --branch
bun install --frozen-lockfile
bun run codegen:validators
bun run controller:test
bun run typecheck
bun run format:check
bun run lint
bun test tooling.test.ts
dotnet build mod/ArdenfallCompendium.csproj -c Debug --nologo -v q
dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --nologo -v q
```

Record whether live `bun run hotrepl:export` was run and what game/build prerequisites were present.
