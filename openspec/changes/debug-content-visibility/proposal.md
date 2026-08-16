## Why

The 2026-08-02 repository health audit found three reader-facing visibility decisions without an owning change or test.

The game type `LocationAsset` marks debug-only map content with `showOnMapDebugOnly`.

`pipeline/src/entities/location/canonicaliser.ts` stores that flag in the read model.

`site/src/lib/components/map/MapCanvas.svelte` hides debug-only points only when `store.ui.showDebug` is false.

`site/src/lib/components/map/MapSidebar.svelte` exposes that state through a client checkbox.

A production client can therefore reveal content that the game gates to debug builds.

The open question is whether production should always hide these locations or intentionally expose them.

The `sk_unarmed` game skill has no `CoreStats` entry, runtime skill key, or consumer.

`HandItem.CalculateDamage` returns zero for it, yet the generated entity route remains reachable.

The open question is whether an authored but vestigial skill should keep a public route.

The game owns the label `Recipe of {0}` and fills its argument at runtime.

`mod/src/Entities/Item/Adapters/ExtractItem.cs` records the asset name without that runtime binding.

The snapshot therefore cannot derive the completed label, and the reader can see the brace form.

The open question is whether to export the binding, show a neutral label, or preserve the source value.

The 2026-08-02 survey and game-field audit provide the evidence for these findings.

## What Changes

- Decide whether production maps hide debug-only locations in every build.
- Consider an intentional production disclosure mode with a clear reader-facing explanation.
- Decide whether `sk_unarmed` keeps a page, loses its route, or remains diagnostic-only.
- Decide whether item snapshots export the runtime argument for `Recipe of {0}`.
- Consider a neutral display label when the runtime argument remains unavailable.
- Identify the game binding source and define a stable snapshot representation before implementation.

The proposal does not select an option for any finding.

## Capabilities

### New Capabilities

- `debug-content-visibility`: Decide how debug-only locations, vestigial skills, and unresolved item labels appear to readers.
