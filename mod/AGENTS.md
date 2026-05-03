# Mod (BepInEx 5) Agent Orientation

The mod walks live Ardenfall runtime objects and emits JSON snapshots. It is **not** a content/gameplay mod.

## Hard rules

- DTOs are explicit. Never serialize Unity objects, Odin containers, `Parameter<T>`, `SmartListParameter<T>`, `RecordID`, or game records directly. Pull values via `.Get()` and put them on a typed snapshot DTO.
- Stable ids come from `BuiltLookupTable.GetGuid(asset)`. Deterministic name-hash fallbacks are last resort and must be flagged unstable in the snapshot ref kind.
- Preflight gates extraction. Every extraction path runs the full preflight immediately before writing — cached readiness state is **not** an authorization token.
- Extraction output is atomic. Write to a staging path, then rename. The pipeline never reads partial files.

## Layout

- `src/Plugin.cs` — entry point, trigger registration.
- `src/Triggers/` — hotkey, console command, advisory readiness monitor.
- `src/Preflight/` — fail-fast gate before snapshot creation.
- `src/Walker/` — generic walker base, cycle detection, ref resolution, provenance.
- `src/Dtos/` — shared DTOs (SnapshotRef, Manifest, Diagnostic).
- `src/Entities/<E>/Adapters/` — per-layer extractor adapters.
- `src/Emit/` — JSON + atomic snapshot writers.

Read `docs/superpowers/specs/2026-04-29-ardenfall-archives-implementation-decisions.md` §11–§14 for the contract.
