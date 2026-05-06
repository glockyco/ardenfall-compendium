# HotRepl-Driven Export Workflow Design

## Status

Direction approved 2026-05-06: improve HotRepl first, then build Ardenfall export automation on top of HotRepl's game-agnostic control plane.

## Decision

Ardenfall Archives will not continue toward a hardcoded in-game export orchestrator. The current F8/manual path remains a useful smoke fallback, but the next strategic work is HotRepl control-plane support in `/Users/joaichberger/Projects/HotRepl`.

After HotRepl supports typed commands, jobs, artifacts, leases, and structured errors, Ardenfall will expose a compiled export API through that control plane. External tooling will own deploy, launch, command sequencing, validation, recovery, and pipeline ingestion.

## Architecture

```text
HotRepl control plane
  game-agnostic command/job/artifact transport

Ardenfall export API
  compiled BepInEx command handlers over current extractor/preflight/writer services

External orchestrator
  deploy -> launch -> connect -> preflight -> begin run -> export batches -> finalize -> validate -> pipeline
```

## In-game API boundary

The Ardenfall mod should expose narrow commands, not a full workflow:

```text
archive.info
archive.preflight
run.begin
run.status
entity.plan
entity.exportBatch
run.finalize
run.discard
game.quit
```

The mod may inspect game state and write snapshot artifacts. It must not decide release policy, pipeline ingestion, retries, or overall workflow ordering.

## External orchestration boundary

The external controller owns:

1. build and deploy HotRepl + Ardenfall export mod;
2. launch Ardenfall;
3. connect to HotRepl and acquire control lease;
4. verify command registry and API versions;
5. poll `archive.preflight` until truthful readiness;
6. open a run with `run.begin`;
7. call `entity.exportBatch` until each required entity is complete;
8. call `run.finalize`;
9. independently validate manifest, hashes, counts, and schemas;
10. run `pipeline:run` only after snapshot validation passes.

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

Current state: Phase G.1-G.5 produced a working F8/manual skeleton with item extraction, manifest writing, and snapshot publishing. Phase G.6 previously required a manual launch + F8 smoke.

Updated direction:

- Do not invest further in the F8 path as the primary automation route.
- Keep G.6 as a manual fallback smoke only.
- Insert HotRepl control-plane work before any new automated export workflow.
- After HotRepl lands, write a new Ardenfall implementation plan for registering export commands and building the external orchestrator.

## Dependency

HotRepl plan:

`/Users/joaichberger/Projects/HotRepl/docs/superpowers/plans/2026-05-06-hotrepl-control-plane.md`

Ardenfall command/orchestrator implementation depends on that plan being complete.
