---
title: "Slice 5 — Location Data Substrate Design"
type: spec
status: implemented
created: 2026-06-02
parent:
superseded_by:
archived: 2026-06-25
---

# Slice 5 — Location Data Substrate Design

Date: 2026-06-02
Status: Approved for implementation planning

## Purpose

Ship the data substrate for Ardenfall locations before any public map UI. This
slice extracts location data from the live runtime graph, canonicalises it into
SQLite, and emits descriptor-owned map metadata that Slice 6 can render without
site-side inference.

The slice is intentionally data-only. It does not introduce deck.gl UI, tile
capture, browser-side SQLite map access, public map interactions, or temporary
public debugging routes.

## Current implemented state

- The item track is complete through presentation depth and closure.
- Public item-adjacent entities already exist for stats, categories, tags, and
  master-tooltip vocabulary.
- HotRepl control uses typed command handlers and the current controller
  protocol.
- Public entity routes are descriptor-owned through `site.route`.
- Pipeline and site read-model code is entity-owned behind thin facades.
- SQLite artifact validation is explicit before deployable artifact publication.
- The next planned content surface is locations, followed by the map system and
  map-supporting entity slices.

Roadmap reconciliation belongs to the Slice 5 implementation plan. The roadmap
must describe the implemented state and next planned state only; it must not
become a changelog.

## External grounding

The following external contracts shape this design:

- Unity world coordinates are the source coordinate space. Unity uses a world
  coordinate system where `y = 0` can represent the floor plane in room/world
  contexts, and horizontal movement is reasoned over the non-vertical axes. The
  compendium must therefore treat source `y` as elevation, not a 2D map axis.
  Source: Microsoft Learn, "Coordinate systems in Unity".
- deck.gl `OrthographicView` renders a top-down XY plane. Its view state centers
  on a `target` and `zoom: 0` maps one world unit to one screen pixel, with each
  zoom increment doubling scale. Source: deck.gl `OrthographicView` docs.
- deck.gl `TileLayer` in a non-geospatial `OrthographicView` uses Cartesian tile
  indices from the world origin; `x: 0, y: 0` covers `[0,0]` to
  `[tileSize,tileSize]`, and increasing `z` doubles tile resolution. It also
  supports `extent` and abortable fetches. Source: deck.gl `TileLayer` docs.

References:

- https://learn.microsoft.com/en-us/windows/mixed-reality/develop/unity/coordinate-systems-in-unity
- https://deck.gl/docs/api-reference/core/orthographic-view
- https://deck.gl/docs/api-reference/geo-layers/tile-layer

These docs are not implementation dependencies for Slice 5, but they prevent a
bad data contract for Slice 6. Slice 5 must emit map coordinates that can feed a
future Cartesian `OrthographicView` directly.

## Scope

### In scope

1. Add a `location` entity descriptor with map metadata. Add `site.route` only
   if complete static location pages ship in the same slice.
2. Extract typed location DTOs from Ardenfall's live runtime graph.
3. Canonicalise location rows into `locations` and `location_volumes` tables.
4. Convert Unity source coordinates into compendium map coordinates once, during
   pipeline canonicalisation.
5. Emit map-layer metadata/read models sufficient for Slice 6 to render points
   and polygons without inventing styling tables.
6. Add fixtures and tests covering descriptor validation, extraction DTO shape,
   canonical geometry, map metadata, read models, and artifact publication.
7. Update roadmap/planning docs to reflect the actual implemented/planned state.

### Out of scope

- Public `/map` route.
- deck.gl dependency installation or browser rendering.
- Tile capture, tile pyramid generation, or `site/static/tiles` staging.
- Map marker clustering, filters, search, legend UI, or hover cards.
- Map-supporting entities such as monsters, vendors, resource nodes, portals, or
  points of interest.
- Auth, remote HotRepl binding policy changes, or deployment workflow changes.
- Hand-authored corrections/overrides.

## Location source audit

Implementation must start with a source audit against the current Ardenfall
managed assemblies and live runtime behavior. The audit must identify:

- the authoritative location root or roots;
- stable ID source for each location asset;
- display name/title source;
- world/zone/region grouping fields, if present;
- position source for point locations;
- volume source for polygon/box/shape locations;
- discovered/hidden/internal flags, if present;
- whether map markers and gameplay volumes are the same data or separate data;
- fields that are behavior-only and should remain private until a presentation
  slice needs them.

Runtime reflection may assist exploration but must not be the final source of
truth. Final extractor code uses explicit DTOs compiled against the current game
DLLs and stable IDs from `BuiltLookupTable.GetGuid(asset)` when the source object
is an asset. If a source object has no GUID-bearing asset identity, the audit
must name the alternative source-of-truth ID and explain why it is stable.

## Mod extraction contract

The mod emits explicit DTOs for locations. It must not serialize Unity objects,
Odin containers, records, transforms, colliders, or game objects directly.

Minimum DTO shape:

```text
LocationSnapshotDto
  id
  name
  sourceKind
  sourceRef
  worldRef / regionRef / parentLocationRef, if available
  position, if available
  volumes[]
  flags, if source-backed
  provenance
  diagnostics[]
```

Volume DTOs carry source coordinates and shape type:

```text
LocationVolumeDto
  id
  locationId
  kind: point | polygon | box | circle | unknown
  sourcePoints[]
  sourceCenter
  sourceExtents
  sourceRotation
  elevationMin
  elevationMax
  provenance
```

The exact DTO fields are finalised by the audit. The implementation must prefer
omitting unsupported fields with diagnostics over inventing default geometry.
Missing required identity or malformed source geometry is fatal for that row or
for the run according to the existing diagnostic policy.

## Canonical SQLite contract

`locations` is the root canonical table. It contains stable identity, public
name, source refs, grouping refs, canonical map position where available, and
source/provenance fields needed for diagnostics.

`location_volumes` contains one row per extracted map/gameplay volume. It stores
canonical geometry in a typed JSON column or child point rows if the audit shows
queries need point-level joins immediately. The default is typed JSON because
Slice 5 does not yet query vertices independently.

Canonical geometry rules:

- Source Unity coordinates remain available only as private/debug evidence or
  provenance.
- Public/read-model coordinates use compendium map coordinates.
- Canonicalisation performs the Unity-to-map transform exactly once.
- Site route loaders and future deck.gl components must not negate, swap, rotate,
  or infer coordinates.
- `source.y` is elevation. The initial 2D map plane uses source horizontal axes;
  the existing roadmap rule says Y-negation belongs in canonicalisation, so the
  slice must reconcile the naming explicitly in code and tests.
- Degenerate polygons, NaN/Infinity coordinates, impossible extents, and unknown
  shape kinds emit diagnostics; fatality depends on whether the row can still be
  represented honestly.

The pipeline must keep descriptor coverage validation fail-fast. Adding
`entities/location/entity.json` without canonicalizer/read-model support must
continue to produce direct descriptor-specific diagnostics.

## Descriptor and map metadata contract

The `location` descriptor owns all map metadata. Public site metadata is present
only if Slice 5 also ships complete static location pages:

```json
{
  "id": "location",
  "site": null,
  "map": {
    "layer": "locations",
    "renderKind": "point-or-polygon",
    "icon": "location",
    "color": [120, 170, 255],
    "radius": 6,
    "tooltip": ["name"]
  }
}
```

The exact schema shape should follow the existing `map` descriptor contract and
only expand it where Slice 5 needs executable data. Styling facts such as color,
radius, icon, tooltip fields, legend label, and z-order must be emitted from the
pipeline into `map_layers` or layer read models. The site must not gain
hand-maintained styling tables keyed by entity kind.

## Site contract

The default Slice 5 site contract is no public `/locations` route. A data-only
location slice can emit canonical tables and map read models without exposing
location pages before the map is ready.

Slice 5 may add static `/locations` and `/locations/[slug]` pages only if the
source audit proves locations have useful standalone public value and the slice
implements complete route loaders, read models, prerender entries, and tests. If
added, they must follow the current static-first route architecture:

- build-time `+page.server.ts` loaders;
- server-only SQLite access through entity read modules;
- prerendered HTML;
- no browser SQLite access;
- no CSR unless a route-level reason is documented.

A public route must not exist as an empty scaffold or reserved placeholder.

## Roadmap and plan hygiene

The implementation must update planning docs as part of the slice:

- Record the current implemented state for Slice 4.5, HotRepl control migration,
  and architecture hardening as state, not as narrative history.
- Keep Slice 5 status and deliverables aligned with the actual plan.
- Do not add changelog prose, time estimates, or commit-by-commit summaries.
- Remove or supersede completed active plans only when the roadmap/specs capture
  the implemented state they represented.

## Verification

Required verification for the implementation plan:

- Descriptor/schema tests for `location.map` metadata and optional `site.route`
  behavior when public pages are present.
- Mod tests for location DTO extraction helpers and diagnostics.
- Pipeline canonicalisation tests for valid points, valid polygons/boxes,
  degenerate geometry, missing IDs, malformed coordinates, and coordinate
  transform invariants.
- Read-model tests for `locations`, `location_volumes`, and `map_layers` output.
- Fixture artifact build from synthetic location data.
- SQLite artifact validation on fixture and release-style outputs.
- Site check/build if any public location route is added.
- Existing root gates: validator generation, fixture checks, Bun tests,
  typecheck, mod tests, site check, formatting, and lint.

Testing must assert behavior and invariants rather than current fixture strings
except where a string is itself the contract, such as a route path or diagnostic
code.

## Acceptance criteria

- A committed `location` descriptor has complete executable support or no public
  route is committed.
- A synthetic fixture with at least one point location and one area location
  canonicalises into SQLite with deterministic `locations` and
  `location_volumes` rows.
- The coordinate transform is tested at edges: origin, positive/negative source
  axes, elevation preservation, and polygon winding/degeneracy.
- `map_layers` contains descriptor-owned location layer metadata with no new
  site styling registry.
- Adding a deliberately unsupported public descriptor still fails with direct
  coverage diagnostics.
- Generated artifacts pass SQLite integrity and sidecar validation.
- Roadmap/spec state matches the implemented project state without changelog
  prose.
