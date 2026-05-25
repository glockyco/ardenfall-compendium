# Export pause audit

## Scope

Investigated the visible pause after the final `entity.exportBatch` completion log and before the `validate` completion log in `bun run hotrepl:export`, by reading the controller export path, HotRepl client/protocol flow, `RunFinalizeCommand`, run manager, snapshot/asset writers, asset exporters, and snapshot validation code. I did not run live game commands.

## What exactly runs in the gap

The gap starts after `controller/src/export-orchestrator.ts:119-120` finishes polling the final `entity.exportBatch` job and writes:

```ts
log({ phase: "entity.exportBatch", status: "completed", runId, offset });
```

Then the controller does the following before any `validate` log is emitted:

1. Calls synchronous HotRepl command `run.finalize` with a 300s timeout:
   - `controller/src/export-orchestrator.ts:123-127`
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:55-63` declares `run.finalize` as `ControlCommandKind.Sync`.
2. Waits silently for HotRepl to return the synchronous command result:
   - `controller/src/hotrepl-client.ts:163-171` sends `command_call` and waits for `command_result`.
   - `../HotRepl/src/HotRepl.Core/Control/ControlCommandRouter.cs:162-185` executes sync commands inline via `.GetAwaiter().GetResult()`.
   - `../HotRepl/src/HotRepl.Core/ReplEngine.cs:151-157` drains command queue and starts jobs; sync command handling blocks this tick until `run.finalize` finishes.
3. Normalizes `publishedDir` from the finalize response:
   - `controller/src/export-orchestrator.ts:129-131`
4. Runs controller-side validation:
   - `controller/src/export-orchestrator.ts:132-133`
   - `controller/src/validate-snapshot.ts:26-71`
5. Only after validation completes, logs:
   - `controller/src/export-orchestrator.ts:134`

Important observability detail: the existing `validate` event is a completion log, not a start log. Therefore the user-visible pause includes **both** all of `run.finalize` and all of `validateSnapshot`, with no marker separating them.

## What `run.finalize` does

`RunFinalizeCommand.ExecuteAsync` performs all final snapshot publication work in one synchronous HotRepl request:

1. Validates `runId`, run existence, and not-finalized state:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:69-90`
2. Runs preflight again:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:92-101`
3. Reads and validates every planned item chunk:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:103-112`
   - `ReadPlannedItemChunks` enumerates expected offsets, checks chunk files, reads each chunk with `File.ReadAllText`, deserializes `ItemSnapshotEnvelope`, validates row count, appends all rows, and flattens row diagnostics: `mod/src/Control/Handlers/RunFinalizeCommand.cs:252-333`.
4. Creates snapshot staging directories and removes any stale staging dir:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:114-128`
5. Serializes/writes/hashes `items.json`:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:134-135`
   - `WriteJson`: `mod/src/Control/Handlers/RunFinalizeCommand.cs:339-344`
6. Extracts non-item entities that were not part of the visible `entity.exportBatch` loop:
   - stat types: `_statTypes.GetOrExtract(run)` / `_statTypes.GetAssetPlan(run)` at `mod/src/Control/Handlers/RunFinalizeCommand.cs:137-138`
   - item categories: `_itemCategories.GetOrExtract(run)` / `_itemCategories.GetAssetPlan(run)` at `mod/src/Control/Handlers/RunFinalizeCommand.cs:139-140`
   - item tags: `_itemTags.GetOrExtract(run)` at `mod/src/Control/Handlers/RunFinalizeCommand.cs:141`
   - these services walk `BuiltLookupTable` on first access: `mod/src/Extraction/StatTypeExtractionService.cs:25-36`, `mod/src/Extraction/ItemCategoryExtractionService.cs:25-36`, `mod/src/Extraction/ItemTagExtractionService.cs:22-33`.
7. Exports all planned sprites to PNG files and appends manifest entries:
   - `RunFinalizeCommand`: `mod/src/Control/Handlers/RunFinalizeCommand.cs:143-152`
   - `ItemAssetManifestWriter.WriteSlots`: `mod/src/Entities/Item/ItemIconSlots.cs:103-118`
   - `SpriteAssetExporter.WriteSpritePng`: `mod/src/Assets/SpriteAssetExporter.cs:143-177`
8. Builds and writes `asset-manifest.json`:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:152`
9. Builds and writes `master-tooltip.json`:
   - `mod/src/Control/Handlers/RunFinalizeCommand.cs:154-155`
   - runtime source reads `ArdenfallMasterData.Instance` and `PotionRecipeManager`: `mod/src/MasterTooltip/MasterTooltipExtractor.cs:25-31`.
10. Serializes/writes/hashes `stat-types.json`, `item-categories.json`, and `item-tags.json`:
    - `mod/src/Control/Handlers/RunFinalizeCommand.cs:157-162`
11. Adds walker diagnostics from item/stat/category/tag extraction and optionally writes `diagnostics.json`:
    - `mod/src/Control/Handlers/RunFinalizeCommand.cs:164-184`
12. Builds `manifest.json`, serializes/writes it, and hashes the manifest JSON for the returned artifact ref:
    - `mod/src/Control/Handlers/RunFinalizeCommand.cs:186-205`
13. Publishes atomically by `Directory.Move(stagingDir, publishedDir)`:
    - `mod/src/Control/Handlers/RunFinalizeCommand.cs:206`
14. Updates in-memory run state and writes `control/run.json` through `CompendiumRunManager.Save`:
    - `mod/src/Control/Handlers/RunFinalizeCommand.cs:208-214`
    - `mod/src/Control/CompendiumRunManager.cs:30-40`
15. Constructs artifact refs and returns the HotRepl command result:
    - `mod/src/Control/Handlers/RunFinalizeCommand.cs:216-243`

## What `validateSnapshot` does after finalize returns

`controller/src/validate-snapshot.ts:26-71` then:

1. Reads and parses `manifest.json`.
2. For every entry in `manifest.hashes`, concurrently:
   - reads the artifact text,
   - computes SHA-256 over the text,
   - compares to the manifest hash,
   - parses JSON.
3. Validates expected entity counts for `items.json`, `stat-types.json`, `item-categories.json`, and `item-tags.json`.
4. Validates `diagnostics.json` shape if present.
5. Fails if manifest fatal diagnostics are non-zero.

It does **not** currently verify every exported PNG exists or matches `asset-manifest.json` `pngHash`; it validates the JSON artifacts listed in `manifest.hashes`.

## Likely time sinks

### 1. Deferred sprite export in `run.finalize` is the largest likely sink

The item batch loop creates item chunks, but it does not write PNG assets. Actual sprite file export is deferred until finalize:

- Item batch captures/exposes item rows and asset plans through the cached extraction service, then writes chunk JSON: `mod/src/Control/Handlers/EntityExportBatchCommand.cs:48-75`.
- Finalize exports every item/stat/category icon slot in one unlogged block: `mod/src/Control/Handlers/RunFinalizeCommand.cs:143-147`.
- Each slot calls `SpriteAssetExporter.WriteSpritePng`, which does GPU texture copy/readback and per-sprite PNG generation:
  - allocates a temporary render texture for the full source texture,
  - `Graphics.Blit(texture, rt)`,
  - allocates a full-size `Texture2D`,
  - `ReadPixels` + `Apply`,
  - `GetRawTextureData`, crop copy,
  - custom PNG encode with uncompressed zlib store,
  - SHA-256 over PNG bytes,
  - filesystem write if the hash path is new.
  - See `mod/src/Assets/SpriteAssetExporter.cs:152-169`.

This is both CPU/GPU/IO heavy and single-threaded on the Unity main thread. It also repeats full-texture readback for each sprite, even when many sprites share one atlas texture.

### 2. First-time stat/category/tag extraction happens after item batches

Only `item` is planned and batched by the controller. Stat types, item categories, and item tags are extracted inside `run.finalize`:

- `mod/src/Control/Handlers/RunFinalizeCommand.cs:137-141`
- `mod/src/Extraction/StatTypeExtractionService.cs:25-36`
- `mod/src/Extraction/ItemCategoryExtractionService.cs:25-36`
- `mod/src/Extraction/ItemTagExtractionService.cs:22-33`

These may be small relative to item icons, but they are invisible work after the final item batch. They also add stat/category icon slots exported in the same asset writer block.

### 3. Chunk merge and JSON serialization/hashing duplicate work

Finalize rereads every chunk file from disk, deserializes all rows, creates a combined in-memory list, serializes the full `items.json`, writes it, and hashes the full JSON string:

- chunk read/deserialization: `mod/src/Control/Handlers/RunFinalizeCommand.cs:296-323`
- full items write/hash: `mod/src/Control/Handlers/RunFinalizeCommand.cs:134-135`, `339-344`

For large item snapshots this is significant CPU, memory allocation, and disk IO. Validation then reads, hashes, and parses the same JSON artifacts again on the controller side.

### 4. Controller validation is also hidden inside the same visible pause

Because there is no `validate` start event, any time in `validateSnapshot` is indistinguishable from finalize time. It reads/hashes/parses all JSON artifacts after finalize returns: `controller/src/validate-snapshot.ts:35-45`.

### 5. Sync HotRepl command shape makes long-running work opaque

`run.finalize` is declared `ControlCommandKind.Sync`, so HotRepl returns no job id and the controller cannot poll progress. HotRepl executes sync command handlers inline in `ControlCommandRouter.ExecuteSynchronous` and blocks the engine tick until done: `../HotRepl/src/HotRepl.Core/Control/ControlCommandRouter.cs:162-185`, invoked from `../HotRepl/src/HotRepl.Core/ReplEngine.cs:412-418`.

By contrast, `entity.exportBatch` is a job (`mod/src/Control/Handlers/EntityExportBatchCommand.cs:34`) and the controller logs after polling terminal job status.

## Performance vs observability

This is **both** a performance problem and an observability problem.

Performance problem:

- Expensive asset export is concentrated after the final visible batch instead of being amortized across batches or split into a separate visible phase.
- `SpriteAssetExporter.WriteSpritePng` performs full texture readback and PNG work per slot, including likely repeated readbacks for sprites sharing the same texture atlas.
- Finalize merges chunks by rereading/deserializing all batch outputs and then validation rereads/rehashes/reparses the published JSON immediately afterward.

Observability problem:

- The final `entity.exportBatch` log reads like export work is done, but finalization still performs extraction, asset export, publication, and validation.
- There is no `run.finalize` started/completed log in the controller.
- There is no `validate` started log; the `validate` event means validation completed.
- `run.finalize` is sync, not a job, so there is no progress polling or phase progress from the game side.
- The controller has a 300s finalize timeout but no heartbeat or phase diagnostics during that interval: `controller/src/export-orchestrator.ts:75-76`, `123-127`.

## Concrete fixes and instrumentation

### Immediate controller observability changes

1. Log start and completion around finalize:
   - In `controller/src/export-orchestrator.ts`, before line 123:
     - `{ phase: "run.finalize", status: "started", runId }`
   - After line 127:
     - `{ phase: "run.finalize", status: "completed", runId, publishedDir }`
2. Log start and completion around validation:
   - Before `await validate(publishedDir)` at `controller/src/export-orchestrator.ts:133`:
     - `{ phase: "validate", status: "started", publishedDir }`
   - Keep the existing completion event at line 134.
3. Include elapsed milliseconds for each phase using `performance.now()` or a small helper around awaited operations. This is low-risk and immediately distinguishes finalize from validation time.

### Convert `run.finalize` from sync command to job

Change `RunFinalizeCommand.Kind` from `ControlCommandKind.Sync` to `ControlCommandKind.Job` and update the controller to use `startJob("run.finalize", { runId })` + `waitForJob`, mirroring `entity.exportBatch`.

Why:

- Finalize is long-running, mutates state, and already has a 300s timeout. It matches job semantics better than sync semantics.
- HotRepl jobs can expose progress via `ControlCommandContext` progress sink; sync commands get `progressSink: null` in `ControlCommandRouter.ExecuteSynchronous` (`../HotRepl/src/HotRepl.Core/Control/ControlCommandRouter.cs:174-180`).
- This avoids a long silent `command_call` wait and allows phase progress from inside finalization.

Required callsites/tests:

- `mod/src/Control/Handlers/RunFinalizeCommand.cs:59`
- `controller/src/export-orchestrator.ts:123-127`
- required command kind in `controller/src/export-orchestrator.ts:65-73`
- command registry expectations in `mod-tests/TypedCommandRegistryTests.cs` if they assert command kind
- controller orchestration tests around finalize order/timeout in `controller/test/export-orchestrator.test.ts`

### Add phase-level progress inside finalize

Instrument `RunFinalizeCommand.ExecuteAsync` with progress reports around the expensive blocks:

- `preflight`
- `readItemChunks` with expected chunk count and current offset/chunk index
- `writeItemsJson`
- `extractStatTypes`
- `extractItemCategories`
- `extractItemTags`
- `exportItemAssets`, `exportStatTypeAssets`, `exportItemCategoryAssets` with slot counts and current index
- `writeAssetManifest`
- `buildMasterTooltip`
- `writeMetadataEntities`
- `writeDiagnostics`
- `writeManifest`
- `publishSnapshot`
- `saveRun`

The most valuable first counter is in `ItemAssetManifestWriter.WriteSlots`: include `Slots.Count`, current index, `entityId`, `slot`, and maybe source texture name/dimensions if cheap. Avoid logging per-sprite to stdout; report structured progress and let the controller decide how often to emit.

### Fix the asset export hot path

1. Cache source texture readbacks per texture during a finalize run.
   - Current `SpriteAssetExporter.WriteSpritePng` performs `Graphics.Blit`, full-size `Texture2D`, `ReadPixels`, and `GetRawTextureData` for each sprite slot.
   - Introduce a per-finalize texture cache keyed by `Texture` instance ID and dimensions. Read a texture once, then crop many sprites from cached RGBA.
   - Keep cache scoped to one finalization to avoid retaining large textures across exports.
2. Deduplicate sprite work before export.
   - Multiple rows/slots may refer to the same sprite or produce identical PNGs. Pre-group by sprite identity/rect/output subdir where possible, export once, then append multiple manifest entries pointing to the same hash/path.
3. Consider using Unity `ImageConversion.EncodeToPNG` only if it is measurably faster and deterministic enough for snapshot hashes. If determinism is more important, keep the custom encoder but remove repeated readback first; that is the bigger structural issue.
4. Add timing counters to `SpriteAssetExporter` for readback, crop, encode, hash, and write. The first live run with these counters should identify whether GPU readback or PNG encode dominates.

### Reduce duplicate JSON IO and parsing where safe

1. Have `run.finalize` return enough manifest/count/hash metadata for the controller to log useful summary without reading everything first.
2. Keep `validateSnapshot` as the correctness gate, but add validate start/completion timings and per-file timings around read/hash/parse.
3. If validation becomes a measured bottleneck, consider validating server-side immediately after writing while serialized strings are already in memory, then let the controller perform a lighter publication smoke check. Do not remove controller validation without replacing the same integrity guarantees.

### Clarify phase names in logs

Rename or augment events so the user sees the actual lifecycle:

- `entity.exportBatch completed` means item chunk written, not snapshot exported.
- Add `snapshot.finalize started/completed` or `run.finalize started/completed`.
- Add `snapshot.validate started/completed`.
- Keep `pipeline completed` as-is, because pipeline runs after validation at `controller/src/export-orchestrator.ts:136-143`.

## Root-cause conclusion

The long visible pause is not an idle wait between export and validation. It is unlogged work: synchronous `run.finalize` plus controller-side `validateSnapshot`, with finalization likely dominating. The main performance suspect is deferred sprite asset export in `RunFinalizeCommand`, especially repeated full-texture GPU readback and PNG encoding in `SpriteAssetExporter.WriteSpritePng`. The main observability defect is that finalize has no start/completion/progress log and validation only logs after completion, so a large amount of real work appears as a blank pause after the final batch log.
