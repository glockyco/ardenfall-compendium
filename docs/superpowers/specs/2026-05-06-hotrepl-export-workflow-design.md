# HotRepl-Driven Export Workflow Design

## Status

HotRepl provides the game-agnostic typed command/job/artifact control plane. Ardenfall Compendium uses that control plane for automated exports and keeps the F8 trigger as a manual smoke fallback.

## Architecture

```text
HotRepl control plane
  game-agnostic command/job/artifact transport
  global command registry visible to BepInEx/MelonLoader host adapters

Ardenfall export API
  compiled BepInEx command handlers over extraction/preflight/writer services

External orchestrator
  deploy -> launch -> connect -> preflight -> begin run -> export batches -> finalize -> validate -> pipeline
```

HotRepl remains game-agnostic. The only HotRepl-side requirement for separate game mods is a global command registry that other loaded assemblies can register with. Ardenfall-specific behavior lives in the Ardenfall Compendium mod and the external controller.

The local Ardenfall Demo installation in the Steam CrossOver bottle has a normal BepInEx 5 layout. Runtime mod DLLs are deployed to the game's `BepInEx/plugins/` directory. `mod/libs/` is only a compile-time reference cache for `dotnet build`.

## In-game API boundary

The Ardenfall mod exposes narrow commands, not a full workflow:

```text
compendium.info
compendium.preflight
run.begin
run.status
entity.plan
entity.exportBatch
run.finalize
run.discard
game.quit
```

The mod inspects game state and writes run artifacts. It does not decide release policy, pipeline ingestion, retries, or overall workflow ordering.

## External orchestration boundary

The external controller owns:

1. verify the one-time BepInEx 5 setup in the CrossOver bottle;
1. build and deploy HotRepl plus the Ardenfall export mod;
1. launch Ardenfall;
1. connect to HotRepl and acquire control lease;
1. verify command registry names and API versions;
1. poll `compendium.preflight` until readiness is truthful;
1. open a run with `run.begin`;
1. call `entity.exportBatch` until each required entity is complete;
1. call `run.finalize`;
1. independently validate manifest, hashes, counts, and schemas;
1. run `pipeline:run` only after snapshot validation passes.

## Artifact model

Game-side run workspace:

```text
<base>/runs/<runId>/
  control/
    run.json
    preflight.json
    events.ndjson
    lock.json
  entities/
    item/
      chunks/
        000001.json
```

Published snapshot contract remains pipeline-friendly:

```text
<base>/snapshots/<gameVersion>-<runId>/
  manifest.json
  items.json
```

Internal control files stay out of the published snapshot unless the pipeline is explicitly taught to ignore them.

## Validation policy

Automated success requires:

- every HotRepl command returns `status: ok`;
- no fatal diagnostics;
- all expected artifacts exist;
- manifest hashes match artifact bytes;
- manifest counts match envelope rows;
- snapshot and manifest schemas pass;
- pipeline ingestion succeeds.

Logs are diagnostic evidence only. They are never success criteria.

## Impact on current Slice 1 plan

Phase G.1-G.5 produced a working F8/manual skeleton with item extraction, manifest writing, and snapshot publishing. The F8 path remains a fallback smoke. Primary automation uses typed HotRepl commands and an external controller.

## Implementation plan

`docs/superpowers/plans/2026-05-06-ardenfall-hotrepl-export-automation.md`
