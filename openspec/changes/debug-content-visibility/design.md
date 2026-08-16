## Context

The proposal identifies three reader-facing decisions. `LocationAsset.showOnMapDebugOnly` is defined at `LocationAsset.cs:29` and stored at `canonicaliser.ts:62`. The map uses `store.ui.showDebug` at `MapCanvas.svelte:56` and exposes it at `MapSidebar.svelte:34`.

`sk_unarmed` has no runtime skill consumer in the surveyed game data. Its generated route remains reachable, as recorded in the proposal. The route policy must be deliberate.

`ExtractItem.cs` records the asset name, as recorded in the proposal. The game label `Recipe of {0}` receives its argument at runtime. The snapshot does not contain that binding.

## Goals / Non-Goals

**Goals:**

- Make production visibility of debug-only locations explicit and resistant to client-side state changes.
- Give the vestigial skill one documented publication status.
- Ensure every reader-facing item label is either resolved or neutral.
- Preserve enough provenance to explain the chosen outcome during export review.

**Non-Goals:**

- Deciding whether debug content has gameplay value.
- Reconstructing arbitrary runtime localisation or UI formatting.
- Making a client toggle an authority for release content.

## Decisions

### 1. Production policy for debug-only locations remains open

The release policy must choose one of two alternatives before implementation:

- Strip debug-only locations from the production snapshot and route index.
- Keep them in the snapshot but enforce visibility on the server and generated route data.

Both alternatives must make a hidden location absent from production reader navigation. A client toggle may change presentation state only for content the release policy already permits. The selected alternative, its export evidence and its failure mode belong in the implementation record.

### 2. The `sk_unarmed` route policy remains open

The release must choose one of two alternatives:

- Keep a public page and mark the skill as vestigial.
- Remove its public route and retain it only as diagnostic or non-public source data.

A route must not remain reachable by accident. The selected policy must cover direct navigation, indexes and relationships.

### 3. The recipe label binding policy remains open

The release must choose one of two alternatives:

- Export a stable runtime binding and resolve the label before rendering.
- Keep the binding unavailable and render a neutral label that contains no format placeholder.

The source label and chosen fallback must remain distinguishable in provenance. The reader must never see a raw format token.

### 4. Client state is not publication authority

The canonical snapshot, route generation and server read model will determine whether content exists in a release. Client state may filter or present allowed content. It may not create a route, row or map point for content excluded by release policy.

## Risks / Trade-offs

- Stripping debug content reduces audit visibility. Server gating preserves evidence but requires every reader entry point to apply the same rule.
- Keeping `sk_unarmed` helps explain authored data but can imply gameplay support. Removing it avoids that implication but loses a direct diagnostic page.
- Exporting a runtime binding can couple the snapshot to a game UI convention. A neutral label avoids coupling but gives readers less source detail.
- A client-side toggle can appear to work against prerendered HTML while failing after hydration. Browser verification must exercise the hydrated production surface.
