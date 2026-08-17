# Mod (BepInEx 5) Agent Orientation

- Treat the mod as an extractor, not a content or gameplay mod.
- Find entry points in `src/Plugin.cs`, triggers in `src/Triggers/`, preflight in `src/Preflight/`, walkers in `src/Walker/`, DTOs in `src/Dtos/`, entity adapters in `src/Entities/<E>/Adapters/`, and writers in `src/Emit/`.

## Hard rules

- Use one of three stable-id mechanisms. `lookupAsset` uses `BuiltLookupTable.GetGuid(asset)` for registered definition assets. `namedAsset` uses `named;<entityId>;<assetName>` for unregistered definition assets. `record` uses the master-record `(table, subtable, id)` for record-backed instances such as portals.
- Never guess entity row ids from names, runtime traversal, or secondary registries. If a required GUID, name, or record value is missing, use the existing diagnostic or fatal path and fix extraction or preflight.
- Stop asset reference resolution at the game namespace boundary. For runtime types outside `Ardenfall`, emit a missing ref with reason `engineResource` and no diagnostic. For an unregistered Ardenfall asset, report `lookupAssetGuidMissing`.
- Keep named asset types in the single registry in `Walker/RefResolver.cs`. Preserve the shared `named;<entityId>;<assetName>` identity contract.
- Enforce one id per row in `Entities/ExtractorLifecycle.cs`. Let the lifecycle drop identical duplicate records with `sourceYieldedDuplicateRecord`, and throw on conflicting duplicates. Do not add duplicate guards to extractors.
- Send every absent or destroyed Unity object through the lifecycle so its entity diagnostic distinguishes it from absent data. Use a loaded asset source `HashSet` only to prevent converting one object twice.
- Never mutate game data during extraction. Read backing values, and derive absent values without writing them back. Report genuinely unknowable values as diagnostics.
- Leave missing record names null. `PortalExtractor` reports `portalFriendlyNameMissing`, and `NpcExtractor` reports `npcFriendlyNameMissing`. The pipeline owns reader-facing unnamed labels.
- Preserve the vertical texture flip in `SpriteAssetExporter.CropRgba`: Unity starts at bottom left, and PNG starts at top left.
- State an unextracted game field as a comment at the extractor that reads its type, and say why the field is skipped. `PortalRecord.isAccessable` is an example. A comment beside the code survives a refactor of the code.
- Pass every extraction source to `RunFinalizeCommand`, including items, stat types, spells, status effects, item categories, tags, locations, and portals. Do not construct live services by default.
- Write extraction output to a staging path, then rename it atomically. Never let the pipeline read partial files.
- Register HotRepl commands through `HotRepl.Control.GlobalControlCommandRegistry`. Keep BepInEx and MelonLoader support working. Use the Phase 4a API: `ControlCommandKind.Sync`, `ControlCommandContext<TOutput>`, and its failure helpers.
- Keep the `operator.*` commands out of the export. They exist for live verification, they never run in an export phase, and `controller/test/export-orchestrator.test.ts` proves an export needs none of them.
- Reach the live game through `IOperatorTarget`, and keep the Unity binding in `UnityOperatorTarget`. The mod tests run on `net10.0` without a Unity runtime, so operator logic must execute against a fake target.
- An operator command reports the live state it produced. When the game finishes a change on a later frame, report that transition instead: closing the free camera runs behind the layer's close animation, and the game's own close step restores the timescale it paused.
- Do not write a value the game already owns and restores. Photo mode never writes the timescale.

## HotRepl dependency

- Build HotRepl first. Run `mod/scripts/copy-libs.sh <Ardenfall Managed dir> <HotRepl.Core output dir>` before `dotnet build mod/ArdenfallCompendium.csproj`.
- Deploy through `bun run hotrepl:deploy`. Put runtime DLLs in the game's `BepInEx/plugins/`, not `mod/libs/`. Deploy every DLL from `HOTREPL_BEPINEX_OUT`, including `HotRepl.BepInEx.dll`, `HotRepl.Core.dll`, and `mcs.dll`.
- Keep `Namotion.Reflection.dll` internalized in `HotRepl.Core.dll`; do not deploy it as a sidecar.
- Keep `mod/ArdenfallCompendium.csproj` on `netstandard2.1` while HotRepl handlers expose `ValueTask<T>` and Ardenfall runs on Unity 2022. Do not retarget it to `net472`.
