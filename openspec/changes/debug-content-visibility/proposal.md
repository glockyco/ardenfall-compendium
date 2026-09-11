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

## Evidence recorded on 2026-09-11

Measured against the release export `0.0.10.91-20260911-1300226367980`, which changes what the three
decisions rest on.

- Debug-only locations: **0 of 1,380** map points carry `showOnMapDebugOnly`. The client toggle in
  `MapSidebar.svelte` guards nothing the Demo ships. The honest resolution is to remove the toggle
  and count the flag in the pipeline as a diagnostic, so a build that ships one surfaces in the
  manifest rather than behind a checkbox.
- `sk_unarmed` still publishes a page at `/stat-types/...`. Nothing new was learned; the decision is
  a policy one. `openspec/specs/entity-identity/spec.md` forbids withholding a page without evidence
  from game behaviour, and `HandItem.CalculateDamage` returning zero is that evidence, so the page
  may be marked vestigial but the withholding must be recorded in the descriptor if chosen.
- `Recipe of {0}`: one item carries the literal name. `Statement.ApplyModifiers` never substitutes
  a brace, but a recipe name is formatted by the recipe UI rather than by a statement, so the label
  is bound at runtime and no asset-time read can complete it. The `entity-identity` rule applies:
  publish, mark, and keep the source label in provenance. Task 4.2 is the resolution.
