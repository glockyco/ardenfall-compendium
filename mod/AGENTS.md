# Mod (BepInEx 5) Agent Orientation

The mod walks live Ardenfall runtime objects and emits JSON snapshots. It is **not** a content/gameplay mod.

## Hard rules

- DTOs are explicit. Never serialize Unity objects, Odin containers, `Parameter<T>`, `SmartListParameter<T>`, `RecordID`, or game records directly. Pull values via `.Get()` and put them on a typed snapshot DTO.
- Stable ids use one of three mechanisms. `lookupAsset` uses `BuiltLookupTable.GetGuid(asset)` for registered definition assets. `namedAsset` uses the definition asset name when `BuiltLookupTable` does not register it, with id `named;<entityId>;<assetName>`, as for `stat-type` and `item-category`. `record` uses the master-record `(table, subtable, id)` for record-backed instances such as portals. Entity row ids must not be guessed from names, runtime traversal, or secondary registries. If a required GUID, name, or record source-of-truth value is missing, emit the existing diagnostic/fatal path and fix the extractor or preflight instead of hiding it with fallback discovery.
- Portal records may legitimately have no name. `PortalExtractor` reports `portalNameMissing` and leaves `name` null rather than substituting the row id.
- Preflight gates extraction. Every extraction path runs the full preflight immediately before writing — cached readiness state is **not** an authorization token.
- Extraction output is atomic. Write to a staging path, then rename. The pipeline never reads partial files.
- HotRepl's wire protocol is v2, while the root TypeScript dependencies use the v4.0.1 `@hotrepl/protocol` and `@hotrepl/sdk` packages that target that protocol. This BepInEx mod registers commands through `HotRepl.Control.GlobalControlCommandRegistry`; HotRepl itself must keep both BepInEx and MelonLoader host support green. The authoring API is Phase 4a (`ControlCommandKind.Sync`, generic `ControlCommandContext<TOutput>`, and `context.ValidationFailed` / `context.PreconditionFailed` failure helpers).

## Layout

- `src/Plugin.cs` — entry point, trigger registration.
- `src/Triggers/` — F8 hotkey fallback and advisory readiness monitor.
- `src/Preflight/` — fail-fast gate before snapshot creation.
- `src/Walker/` — generic walker base, cycle detection, ref resolution, provenance.
- `src/Dtos/` — shared DTOs (SnapshotRef, Manifest, Diagnostic).
- `src/Entities/<E>/Adapters/` — per-layer extractor adapters.
- `src/Emit/` — JSON + atomic snapshot writers.

The hard rules above are the durable contract; the canonical types live in `src/Dtos/` and the entity adapters under `src/Entities/`.

## HotRepl dependency

The Ardenfall mod implements HotRepl Phase 4a typed control handlers through `HotRepl.Control.GlobalControlCommandRegistry`. The mod references ignored local DLLs under `mod/libs/` at compile time; runtime DLLs belong in the game's `BepInEx/plugins/` directory, not `mod/libs/`.

Build HotRepl first, run `mod/scripts/copy-libs.sh <Ardenfall Managed dir> <HotRepl.Core output dir>` before `dotnet build mod/ArdenfallCompendium.csproj`, and then deploy through `bun run hotrepl:deploy`. Deploy ships every DLL from `HOTREPL_BEPINEX_OUT` into `BepInEx/plugins/HotRepl/` and requires at least `HotRepl.BepInEx.dll`, `HotRepl.Core.dll`, and `mcs.dll` to be present in that source directory. `Namotion.Reflection.dll` is internalized into `HotRepl.Core.dll`, is not in the required-DLL contract, and is not deployed as a sidecar.

`mod/ArdenfallCompendium.csproj` targets `netstandard2.1` because HotRepl's control contracts expose `ValueTask<T>` from a `netstandard2.1` assembly and Ardenfall runs on Unity 2022, which supports .NET Standard 2.1. Do not retarget the mod back to `net472` while it implements HotRepl command handlers.
