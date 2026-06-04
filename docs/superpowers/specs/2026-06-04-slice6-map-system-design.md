# Slice 6 — Map System Design

Date: 2026-06-04
Status: Approved for implementation planning

## Purpose

Ship the first public map surface for the Ardenfall Compendium: an interactive,
top-down vector map of locations rendered with deck.gl, plus the cross-linking
backbone that lets the rest of the compendium point at places and lets the map
point back at entities.

Slice 5 already emits the full data contract the renderer consumes
(`location_map_points`, `location_map_volumes`, descriptor-owned `map_layers`
with pre-transformed `map_x/map_y/elevation`). Slice 6 is therefore almost
entirely site work, plus one small pipeline addition: emitting public
relationship-graph nodes for locations so cross-entity links resolve and are
validated.

The slice is intentionally **vector-first**. Base map tile imagery and tile
capture are deferred. The slice builds the data-driven rendering, interaction,
and cross-linking model so future map-supporting entity slices and tile imagery
are additive, not rewrites.

## Current implemented state

- The item track is complete through presentation depth and closure.
- A generated relationship graph exists: `entity_nodes`, `entity_aliases`,
  `entity_redirects`, `entity_disambiguations`, `entity_edges`,
  `entity_relationship_sections`, with a fail-fast `relationshipMissingTarget`
  audit and generic `RelationshipSection`/`EntityLink` site components that
  render `edge.targetRoutePath` + `edge.targetLabel`.
- Public entity routes are descriptor-owned through `site.route`. The site is
  static-first: SSR + prerender, CSR off by default.
- Slice 5 delivered the location data substrate: canonical `locations` and
  `location_volumes`; the Unity `(x,y,z)` to compendium `(map_x,map_y,elevation)`
  transform performed once in canonicalisation; descriptor-owned `map_layers`
  (now carrying `source_tables_json`); `location_map_points` and
  `location_map_volumes` read models; synthetic fixture coverage. Locations have
  descriptor `site: null` and no public route.
- deck.gl is not a site dependency yet.

## External grounding

The following external contracts and constraints shape this design. They are
cited because they change concrete decisions, not as background reading.

- deck.gl `OrthographicView` renders a top-down Cartesian XY plane. `zoom: 0`
  maps one world unit to one screen pixel; each `+1` doubles scale; the view
  centers on `target`. Non-geospatial layers default to `coordinateSystem:
'cartesian'`. Source: deck.gl OrthographicView / coordinate-systems docs.
- deck.gl standalone (`@deck.gl/core`, `@deck.gl/layers`) is the documented
  non-React entry point (`new Deck({...})`); React bindings are a separate path.
  `deck.finalize()` frees all GPU/DOM resources. Source: deck.gl
  using-standalone / Deck API docs.
- deck.gl performance guidance: data arrays are shallow-compared, so replacing
  `data` regenerates GPU buffers; toggle with `visible`, keep stable layer `id`s,
  keep accessors allocation-free, gate updates with `updateTriggers`. Source:
  deck.gl performance / using-layers docs.
- Browsers cap simultaneous WebGL contexts (commonly 8-16); deck.gl recommends a
  single Deck instance per page and warns that excess instances cause "Too many
  active WebGL contexts. Oldest context will be lost." This rules out many live
  maps on list pages and makes per-navigation `finalize()` a correctness
  requirement. Sources: deck.gl discussion #7412; WebGL anti-patterns;
  virtual-webgl.
- SvelteKit page options are per-route: `ssr`, `prerender`, `csr`. `ssr = false`
  ships an empty shell and is discouraged; `csr = false` ships no JS. Browser-only
  libraries must be guarded with `onMount`/`$app/environment.browser` or dynamic
  `import()`. Source: SvelteKit page-options / FAQ / `$app/environment` docs.
- Cross-entity links should be derived from a single source of truth (one edge
  yields both directions) with stable permalinks; manually maintained per-page
  cross-links rot. Sources: Single source of truth, Link rot (Wikipedia);
  bidirectional-link/knowledge-graph engineering guidance.
- Cloudflare Workers Static Assets limits (current): free tier 20,000 files /
  25 MiB per file; paid 100,000. This site targets the free tier, so per-entity
  generated image files are budget-relevant. Source: Cloudflare Workers
  static-assets billing-and-limitations docs.
- SVG supports embedded raster via the `<image>` element, so a build-time vector
  preview can later composite a base tile/crop image beneath vector markers.
  Source: SVG `<image>` (MDN).

References:

- https://deck.gl/docs/api-reference/core/orthographic-view
- https://deck.gl/docs/developer-guide/coordinate-systems
- https://deck.gl/docs/get-started/using-standalone
- https://deck.gl/docs/api-reference/core/deck
- https://deck.gl/docs/developer-guide/performance
- https://github.com/visgl/deck.gl/discussions/7412
- https://webglfundamentals.org/webgl/lessons/webgl-anti-patterns.html
- https://svelte.dev/docs/kit/page-options
- https://svelte.dev/docs/kit/$app-environment
- https://en.wikipedia.org/wiki/Single_source_of_truth
- https://en.wikipedia.org/wiki/Link_rot
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developer.mozilla.org/en-US/docs/Web/SVG/Element/image

## Scope

### In scope (v1 build)

1. A singleton interactive map route `/map` rendered with deck.gl standalone in
   an `OrthographicView`, loaded only on this route.
2. A build-time `+page.server.ts` loader that shapes a serializable `MapView`
   payload from the Slice 5 read models and `map_layers`, grouped by `mapId`.
3. A data-driven layer factory `createEntityLayers(layerConfig, rows, filters)`
   backed by a closed `render_kind` registry.
4. Map UX: pan/zoom with visible controls and keyboard operability, fit-to-data
   initial view, point markers, volume polygons, hover tooltip (name), click to
   open an accessible details panel, legend + per-layer toggles, name search with
   zoom-to/select, flag filters (debug-only off by default, fast-travel),
   responsive desktop/mobile layouts.
5. URL-addressable state: view, selection, visible layers, filters, active map.
6. Cross-linking backbone: pipeline emits public `entity_nodes` for locations
   whose `route_path` is the map deep link; the map details panel renders the
   selected location's relationship section using the existing shared component.
7. A "Map" entry in site navigation.
8. Add `@deck.gl/core` and `@deck.gl/layers` as site dependencies.
9. Verification: unit tests for pure logic, prerender smoke, a browser E2E
   against the built fixture, and the root gates.
10. Roadmap/spec updates reflecting implemented and next-planned state only.

### Out of scope (deferred, with the model reserved here)

- Base map tile imagery, tile capture, tile pyramid generation,
  `site/static/tiles` staging, `@deck.gl/geo-layers`/`TileLayer`.
- Map-supporting entities (monsters, vendors, NPCs, portals, resource nodes,
  POIs) and their data/edges.
- Materialised transitive spatial edges (item→location via vendor/monster, etc.)
  — the model is specified here but generation lands with the first placed
  intermediary slice.
- The `LocationMiniMap.svelte` static SVG embed and its consumers on entity
  pages — specified here; built with its first real consumer.
- Inline interactive (click-to-activate) embedded maps on content pages.
- Live in-game marker sync — seam specified here; not built.
- Marker clustering, minimap, measurement tools, progress/notes/accounts.
- Marker icon-atlas rendering (location icon assets are not yet exported).

## Route and data flow

`/map` is a singleton application route, not a descriptor `site.route`
(`site.route` is for entity overview/detail pages; the map is one surface that
renders every layer declared in `map_layers`). It does not introduce a manual
registry: layers come from pipeline data, not hardcoded lists.

- `src/routes/map/+page.ts`: `prerender = true`, `ssr = true`, `csr = true`.
  The map route is the documented CSR exception; CSR stays off everywhere else.
- `src/routes/map/+page.server.ts`: runs at build time. Reads through a new map
  accessor in `src/lib/server/read-models.ts` and returns a serializable
  `MapView` payload (see contract below). No browser SQLite; no coordinate
  transforms (Slice 5 already emitted final coordinates).
- `src/routes/map/+page.svelte`: prerenders a static shell — header, search,
  sidebar (legend/toggles/filters), a sized map container, and a no-JS fallback
  message — with `MapView` embedded for hydration. It renders the client-only
  `MapCanvas` only after mount.
- deck.gl is dynamically `import()`ed inside `MapCanvas`'s `onMount`; no deck.gl
  value import appears in any module that can execute during SSR/prerender.

### `MapView` data contract (loader output)

The loader shapes data once so client accessors stay allocation-free:

```text
MapView
  maps: MapSummary[]            // grouped by mapId; { mapId, label, bounds }
  layers: MapLayerConfig[]      // parsed from map_layers (color/radius/icon/
                                //   tooltipFields/filters/renderKind/zOrder/
                                //   sourceTables/legendLabel)
  points: MapPointRow[]         // { id, layerId, mapId, position:[x,y,elev],
                                //   name, tooltip, flags:{debugOnly,fastTravel},
                                //   nodeShortId }
  volumes: MapVolumeRow[]       // { id, layerId, locationId, mapId,
                                //   ring:number[][], elevationMin, elevationMax,
                                //   name }
```

`MapLayerConfig` parses every JSON column from `map_layers` exactly once. Colors
become `[r,g,b,a]`; `tooltip_fields_json`/`filters_json`/`source_tables_json`
become arrays. `position`, `tooltip` text, and polygon `ring` are precomputed in
the loader, not in deck.gl accessors.

## Layer factory and render-kind registry

`src/lib/map/layer-factory.ts` exposes
`createEntityLayers(config: MapLayerConfig, rows, filters): Layer[]`.

- A closed `render_kind` registry maps kinds to deck.gl layers. The Slice 5
  descriptor kind `point-or-polygon` expands to two layers: a `ScatterplotLayer`
  for points and a `PolygonLayer` for volumes. (v1 marker rendering uses
  `ScatterplotLayer` circles coloured from `map_layers.color`; `IconLayer`/icon
  atlas is reserved for when location icon assets are exported.)
- Unknown `render_kind`, or a declared layer whose source table/rows are absent,
  produces a visible configuration error/diagnostic — never a silently empty or
  mis-rendered layer. This matches the repo fail-fast invariant.
- Stable layer `id`s; layer visibility toggled via `visible`; `updateTriggers`
  keyed only on primitive style values; accessors read precomputed row fields.
- Adding a future entity layer is data/config only (a new `map_layers` row from a
  new descriptor); no per-entity branch in render code. The only entity-specific
  site code permitted is an optional details-panel field renderer (see
  Cross-linking).

## UI/UX

All UI state (selection, search text, visible layers, filters, view, active map)
is separate from the immutable build-loaded `MapView` data, so style/filter
changes never regenerate GPU buffers unnecessarily.

### Desktop (>=1024px)

```
+---------------------------------------------------------------+
| Ardenfall > Map        [ Search locations...        (search) ]|
+--------------+------------------------------------------------+
| LAYERS       |                                        [ + ]   |
|  [x] Locations|             MAP CANVAS (deck.gl)       [ - ]   |
|   o points    |        markers + volume polygons      [ fit ] |
|   [] areas    |                                                |
| FILTERS      |            . selected highlighted               |
|  [ ] Debug   |                                                |
|  [x] FastTrav|                                                |
| (legend from |                                                |
|  map_layers) |                                                |
+--------------+------------------------------------------------+
| > DETAILS PANEL (on selection; collapsed otherwise)           |
|   Harbor Town                                          [ x ]   |
|   map . x,y . elevation . fast-travel . area WxH               |
|   Relationship section (shared component; empty until edges)   |
|   [ Copy link ]                                                |
+---------------------------------------------------------------+
```

### Mobile (<768px)

```
+---------------------------+
| (menu)  Map     [ search ]|   menu opens layers/filters sheet
+---------------------------+
|                           |
|      MAP CANVAS    [ + ]  |
|                    [ - ]  |
|                    [ fit ]|
+---------------------------+
| ^ Harbor Town             |   bottom sheet on tap (drag to expand)
|   fast-travel . area      |
+---------------------------+
```

Tap opens a bottom sheet, not a cramped popup. Same component tree, responsive
containers.

### Components

```
routes/map/+page.server.ts        build-time loader -> MapView
routes/map/+page.ts               prerender + ssr + csr=true
routes/map/+page.svelte           static shell + client-only MapCanvas
lib/server/read-models.ts         map accessor (parse map_layers + shape rows)
lib/map/url-state.ts              pure encode/decode (unit-tested)
lib/map/layer-factory.ts          createEntityLayers + render_kind registry (unit-tested)
lib/map/map-store.svelte.ts       reactive UI state: rows-by-layer, visibility,
                                    filters, selection, view
lib/components/map/MapCanvas.svelte    client-only Deck host
lib/components/map/MapSidebar.svelte   legend + toggles + filters
lib/components/map/MapSearch.svelte    search box + results
lib/components/map/DetailsPanel.svelte selection details (+ RelationshipSection)
```

Pure logic (factory, url-state, loader shaping) is browser-free and unit-tested;
only `MapCanvas` is client-only.

### Lifecycle and accessibility

- `MapCanvas` creates `Deck` inside a synchronous `onMount` (dynamic import),
  returns a synchronous cleanup that calls `deck.finalize()`, observes container
  resize, and never stores `Deck` at module scope (HMR/navigation-leak safety).
  Layer/filter/selection changes call `deck.setProps`, not re-instantiation.
- Visible `+`/`-`/fit controls (not gesture-only); keyboard operable search,
  results, and legend toggles; focus moves from a chosen search result to the
  selection; click/tap selection drives the panel. Hover tooltip is a
  desktop-only enhancement, never the sole way to read marker info.

### Interaction flows

- Locate: type query -> result list -> Enter/click -> center + select + panel +
  URL update.
- Inspect: click marker -> panel with facts, geometry highlighted; Esc/close
  deselects and updates URL.
- Declutter: toggle a layer or the debug filter -> markers show/hide via
  `visible` (no data reload).
- Share/return: pan/zoom (`replaceState`), select (`pushState`), copy link ->
  reopen restores view + selection.

## URL-addressable state

`src/lib/map/url-state.ts` is a pure encode/decode of
`{ mapId?, center, zoom, selected?, layers?, filters }` to/from query params
(`?map=&v=&z=&sel=&layers=&debug=&ft=`). Pan/zoom churn uses `replaceState`;
meaningful selection uses `pushState`. State round-trips on load. This module is
fully unit-tested and shared by the page (initial state) and the store.

## Multi-map handling

`MapView.maps` groups rows by `mapId`. If exactly one map is present, no switcher
renders. If more than one, a minimal in-page selector writes `?map=`. Data-driven
so it is correct either way without speculative UI. A future clean upgrade
(noted, not built) is prerendered `/map/[mapId]` deep-link routes once multiple
maps prove worth separate permalinks.

## Cross-linking model

The map plugs into the existing relationship graph; it never grows a parallel
link table. One edge yields both directions; permalinks are stable.

### Locations as public nodes (the one pipeline addition in this slice)

The pipeline emits an `entity_nodes` row per location with `is_public = 1`,
derived `canonical_slug`/`short_id` (reusing the existing slug derivation), and
`route_path = /map?map=<mapId>&sel=<shortId>` — a stable permalink. The map is
the location's detail surface; no `/locations/[id]` page is created.

Consequence: the existing fail-fast `relationshipMissingTarget` audit guarantees
that any current or future edge targeting a location resolves to a real, public
location, or the build fails.

### Forward links (content page -> map)

Future entities with spatial relationships emit typed `entity_edges` targeting
location nodes. The existing `RelationshipSection`/`EntityLink` components render
`edge.targetRoutePath` (the map deep link) + `edge.targetLabel` with no new link
code; the marker arrives preselected.

### Back links (map -> content page)

`DetailsPanel` renders the selected location's edges with the same
`RelationshipSection` component item pages use. Empty until edges exist (the
component already hides empty sections), so it is honest now and populated later.

### Per-entity panel renderer extension point

Location-specific (and future per-entity) panel fields render through an optional
`lib/entities/<id>/map-panel.ts` registry merged at boot, mirroring the existing
`lib/entities/<id>/` section-renderer pattern. No registry entry -> a generic
field panel renders. This keeps the "filesystem is the registry" invariant.

### Transitive spatial edges (model reserved; generation deferred)

Most "where" relationships are transitive: an item is `sold-by` a vendor that is
`located-at` a place, or `dropped-by` a monster that `spawns-at` a place; a quest
is `given-by` an NPC that is `located-at` a place.

These are handled by generating **derived** spatial edges in the pipeline
relationship builder, alongside the real edges, with no route-local traversal:

- Real edges (as future slices add data): `item->vendor (sold-by)`,
  `monster->item (drops)`, `vendor->location (located-at)`,
  `monster->location (spawns-at)`, `npc->quest (gives)`, `quest->item (requires)`.
- Derived edge: e.g. `item ->obtainable-at-> location`, carrying
  `entity_edges.evidence_json = { via:[{type,id,predicate}], hops }` and a human
  `label` ("Sold by Merchant Aldo"). The map panel and the entity page both
  render edges with the same components.

Two rules bound the cost (the link-explosion pitfall):

- **Bounded depth.** Materialise only one transitive hop through a placed entity
  (`entity -> [placed entity] -> location`). Deeper chains (quest -> required
  item -> vendor -> location) are not flattened; the quest page shows required
  items, and each item page shows where it is obtainable. Users follow one link.
- **Aggregate by target.** Dedupe to distinct locations, cap displayed count,
  weight by hop count.

Slice 6 emits only the location nodes (valid, validated targets). Derived-edge
generation lands with the first placed intermediary slice.

## Embedding maps on content pages (model reserved; built with first consumer)

Per the WebGL context cap and the static-first architecture, content pages do
not embed live deck.gl maps. Instead:

- A reusable `LocationMiniMap.svelte` renders at build time as **inline SVG** for
  a small focus area: scaled `viewBox`, `<circle>` markers, `<polygon>` volumes,
  wrapped in a "View on full map" link to `/map?...&sel=`. It is prerender-safe,
  ships no WebGL/JS, causes no layout shift, and is crawlable.
- When tiles exist, the same generator composites the base imagery via an SVG
  `<image href="/tiles/<map>/<z>/<x>/<y>.webp">` (or a single pre-composed crop)
  beneath the vector markers. Same component, same coordinate scaling.
- Inline SVG adds **zero per-entity files**; tile/crop images are shared,
  deployed-once assets referenced by URL. A per-entity raster image is rejected
  on file-count grounds: one raster per item detail alone is ~1.3k files against
  the free-tier 20,000-file budget, multiplied by every future entity type.

deck.gl loads only on `/map`. Inline click-to-activate interactive embeds remain
a possible future opt-in; their real cost is the deck.gl bundle and forcing CSR
on content routes, not a per-page WebGL context. They are not built here.

## Live in-game marker seam (designed; not built)

v1's enabling decision is that layers read rows from a reactive
rows-by-layer map, and the Deck host re-renders via `deck.setProps` whenever that
map changes. v1 has exactly one data source: the build-time static loader.

A future live overlay (a local operator/dev mode, never the static production
deploy) becomes an additive producer: a `LiveDataSource` subscribes to the
existing local game bridge (controller/HotRepl) and pushes normalised rows into
the same reactive map under a `live:*` layer id. The factory, legend, filters,
selection, and URL state are unchanged. Three rules keep this honest:

- Source is separate from layer config: a config (identity/style from
  `map_layers`) never hardcodes where rows come from.
- Live is opt-in and clearly marked, never a production data path or silent
  fallback; production stays "pipeline SQLite only".
- One normalised row shape regardless of source, so static and live data are
  interchangeable to the renderer.

No `LiveDataSource` code is written in Slice 6.

## Dependencies

Add `@deck.gl/core` and `@deck.gl/layers` (standalone, non-React) to the site,
imported only inside the `/map` client component. `@deck.gl/geo-layers`
(`TileLayer`) is not added; it arrives with tiles.

## Fail-fast and invariants

- No coordinate re-transform anywhere in site code; the loader and components
  consume Slice 5's final `map_x/map_y/elevation`.
- Unknown `render_kind`, a declared layer with no source table, or a relationship
  edge targeting a missing/non-public location is a visible diagnostic/error, not
  a silent empty map.
- deck.gl never executes during SSR/prerender.
- The map contributes nodes (now) and edges (later) to the single relationship
  graph; it never introduces a second link table or route-local link inference.

## Verification

- Unit tests (browser-free):
  - `layer-factory`: each `render_kind`; `point-or-polygon` expands to a marker
    layer plus a polygon layer; unknown kind raises a visible error; filters map
    to `visible`/filtered rows as specified.
  - `url-state`: round-trip of view/selection/layers/filters/map; `replaceState`
    vs `pushState` selection encoded correctly.
  - server loader shaping: `map_layers` parsed once; rows grouped by `mapId`;
    precomputed `position`/`ring`/`tooltip`; debug-only/fast-travel flags carried.
  - pipeline: location `entity_nodes` emitted with `is_public = 1`, derived
    slug/short_id, and `route_path` = map deep link; graph audit still passes;
    coverage/diagnostics unchanged for unsupported descriptors.
- Prerender smoke: `/map` emits static shell HTML with embedded `MapView` and no
  deck.gl in the SSR/prerender output; a "Map" nav link is present.
- Browser E2E (puppeteer) against the built fixture site: map mounts; markers and
  volumes render; click opens the panel; a filter toggles a layer; search selects
  and centers a marker; the URL reflects view + selection and restores on reload.
- Root gates: `bun run codegen:validators`, `bun run check:fixtures`,
  `dotnet test mod-tests/...`, `bun test pipeline/test tooling.test.ts
controller/test`, `bun run typecheck`, `bun run --cwd site check`,
  `bun run artifact:fixture synthetic fixtures/synthetic/snapshot`,
  `bun run --cwd site build:fixture`, `bun run --cwd site smoke:prerender`,
  `bun run format:check`, `bun run lint`, `git diff --check`.

Tests assert behavior and invariants rather than fixture strings, except where a
string is itself the contract (route path, query-param keys, diagnostic codes).

## Open questions

- #6 Tile capture specifics: partially advanced. Slice 6 confirms vector-first
  and defers tile capture/pyramid/staging; the SVG embed and `TileLayer` paths
  are specified so tiles slot in without a renderer rewrite. The capture/stitch
  strategy itself remains open for the tile slice.
- #9 Map-supporting entity ordering: the Slice 6 implementation plan must
  enumerate the candidate set (monsters, vendors, NPCs, portals/connections,
  resource nodes, POIs) and propose an order by map-marker volume and detail-page
  value, then fold that ordering into the roadmap as non-provisional.

## Acceptance criteria

- `/map` builds as a prerendered shell with embedded data and renders an
  interactive deck.gl `OrthographicView` map of the synthetic fixture's
  locations, with markers and volume polygons, on the client only.
- Pan/zoom (with visible controls + keyboard), fit-to-bounds initial view, hover
  tooltip, click-to-select details panel, legend + layer toggles, name search
  with zoom-to, and debug-only/fast-travel filters all work against the fixture.
- View, selection, visible layers, filters, and active map are URL-addressable
  and restore on reload.
- The layer factory is data-driven from `map_layers`; an unknown `render_kind`
  fails visibly; no per-entity branch exists in render code.
- The pipeline emits public location `entity_nodes` whose `route_path` is the map
  deep link; the relationship graph audit passes; the map details panel renders a
  (currently empty) relationship section via the shared component.
- A "Map" navigation entry links to `/map`.
- deck.gl is absent from SSR/prerender output and from non-map route bundles.
- Generated artifacts pass SQLite integrity and sidecar validation; root gates
  pass; browser E2E passes.
- Roadmap/spec state matches the implemented and next-planned state without
  changelog prose; open questions #6 and #9 are updated as described.
