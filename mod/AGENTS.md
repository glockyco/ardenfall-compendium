# Mod (BepInEx 5) Agent Orientation

The mod walks live Ardenfall runtime objects and emits JSON snapshots. It is **not** a content/gameplay mod.

## Hard rules

- Stable ids use one of three mechanisms. `lookupAsset` uses `BuiltLookupTable.GetGuid(asset)` for registered definition assets. `namedAsset` uses the definition asset name when `BuiltLookupTable` does not register it, with id `named;<entityId>;<assetName>`, as for `stat-type`, `item-category`, and `spell`. `record` uses the master-record `(table, subtable, id)` for record-backed instances such as portals. Entity row ids must not be guessed from names, runtime traversal, or secondary registries. If a required GUID, name, or record source-of-truth value is missing, emit the existing diagnostic/fatal path and fix the extractor or preflight instead of hiding it with fallback discovery.
- Asset reference resolution stops at the game namespace boundary. Assets whose runtime type is outside `Ardenfall` are engine resources the compendium deliberately does not catalogue, so they produce a missing ref with reason `engineResource` and no diagnostic. An Ardenfall asset that is not registered in `BuiltLookupTable` is a real extraction gap and must still report `lookupAssetGuidMissing` through the missing-ref policy.
- Named-asset identity is a single type-to-entity registry in `Walker/RefResolver.cs`, not a branch per named type. Add named asset types to that registry and keep their names flowing through the shared `named;<entityId>;<assetName>` identity contract.
- One id identifies one row, and the rule lives once, in `Entities/ExtractorLifecycle.cs`. Instance records live per world cell and the game's cell wrapper walks every cell of every map, so a record present in two cells arrives as two objects carrying one id. Six of 314 NPC records do this. A repeat whose serialised form matches the first is dropped and reported as `sourceYieldedDuplicateRecord`. A repeat that differs throws, because nothing at that layer can know which is right. Do not add a duplicate guard to an extractor. Five extractors used to carry their own while five entities had none, which is how the first real collision reached a primary key.
- A source never drops a row in silence. An absent or destroyed Unity object goes to the lifecycle, which emits the entity's own diagnostic, so a destroyed object and genuinely absent data stay distinguishable. The reference `HashSet` in a loaded asset source is a different job: it stops one object being converted twice, which is discovery, while the lifecycle stops one id being emitted twice, which is identity.
- Extraction never changes what it reads. A game accessor can mutate: `NPCRecord.SpawnPoint` writes its own cache from the transform when the value is empty, and `CharacterData.CharName` invents a random name when the stored one is blank. Read the backing value, and where it is absent derive the same result the game derives without writing it back. A value that is genuinely unknowable is a diagnostic, never a guess.
- Records may legitimately have no name. `PortalExtractor` reports `portalFriendlyNameMissing` and `NpcExtractor` reports `npcFriendlyNameMissing`, and both leave the name null rather than substituting a row id. The reader-facing unnamed label belongs to the pipeline, not here.
- A texture leaves Unity upside down. Unity puts a texture's origin at the bottom left and PNG puts it at the top left, so `SpriteAssetExporter.CropRgba` copies rows in reverse. Every exported icon was mirrored until this was found, and a crop or resize added later must keep the flip.
- A field the game stores but never reads is a finding, not a feature. `PortalRecord.isAccessable` is only touched by `Copy()` and is true on all 33 rows, so extracting it would add a column carrying no information. Record such a field in `docs/plans/2026-08-03-game-field-assumptions.md` and leave it unextracted.
- `RunFinalizeCommand` takes every extraction source as a required constructor argument, including items, stat types, spells, status effects, item categories and tags, locations, and portals. Do not add default live-service construction. A default can hide a wiring mistake and make tests instantiate real Unity services instead of the supplied fake.
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
