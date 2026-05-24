# Mod (BepInEx 5) Agent Orientation

The mod walks live Ardenfall runtime objects and emits JSON snapshots. It is **not** a content/gameplay mod.

## Hard rules

- DTOs are explicit. Never serialize Unity objects, Odin containers, `Parameter<T>`, `SmartListParameter<T>`, `RecordID`, or game records directly. Pull values via `.Get()` and put them on a typed snapshot DTO.
- Stable ids come from `BuiltLookupTable.GetGuid(asset)`. Deterministic name-hash fallbacks are last resort and must be flagged unstable in the snapshot ref kind.
- UI-derived presentation DTOs must be deterministic and base-state-only. Use a versioned render context, keep presentation separate from canonical fields, emit omissions/diagnostics instead of faking player/inventory/merchant state, and never instantiate UI panels or trigger hover side effects just to obtain text.
- Preflight gates extraction. Every extraction path runs the full preflight immediately before writing — cached readiness state is **not** an authorization token.
- Extraction output is atomic. Write to a staging path, then rename. The pipeline never reads partial files.
- HotRepl integration is framework-neutral at the control-plane boundary. This BepInEx mod registers commands through `HotRepl.Control.GlobalControlCommandRegistry`; HotRepl itself must keep both BepInEx and MelonLoader host support green.

## Layout

- `src/Plugin.cs` — entry point, trigger registration.
- `src/Triggers/` — F8 hotkey fallback and advisory readiness monitor.
- `src/Preflight/` — fail-fast gate before snapshot creation.
- `src/Walker/` — generic walker base, cycle detection, ref resolution, provenance.
- `src/Dtos/` — shared DTOs (SnapshotRef, Manifest, Diagnostic).
- `src/Entities/<E>/Adapters/` — per-layer extractor adapters.
- `src/Emit/` — JSON + atomic snapshot writers.

Read `docs/superpowers/specs/2026-04-29-ardenfall-compendium-implementation-decisions.md` §11–§14 for the contract.

## HotRepl dependency

The Ardenfall mod implements HotRepl v3 typed control handlers through `HotRepl.Control.GlobalControlCommandRegistry`. The mod references ignored local DLLs under `mod/libs/` at compile time; runtime DLLs belong in the game's `BepInEx/plugins/` directory, not `mod/libs/`.

Build HotRepl first, run `mod/scripts/copy-libs.sh <Ardenfall Managed dir> <HotRepl.Core output dir>` before `dotnet build mod/ArdenfallCompendium.csproj`, and deploy the HotRepl host plus `HotRepl.Core.dll` to `BepInEx/plugins/`. `Namotion.Reflection.dll` is internalized into `HotRepl.Core.dll`; never deploy it as a sidecar.

`mod/ArdenfallCompendium.csproj` targets `netstandard2.1` because HotRepl's control contracts expose `ValueTask<T>` from a `netstandard2.1` assembly and Ardenfall runs on Unity 2022, which supports .NET Standard 2.1. Do not retarget the mod back to `net472` while it implements HotRepl command handlers.
