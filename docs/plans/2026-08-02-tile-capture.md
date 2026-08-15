---
title: Tile Capture
type: spec
status: draft
created: 2026-08-02
parent: 2026-04-29-ardenfall-compendium-roadmap
superseded_by:
archived:
---

# Tile Capture

Render the Ardenfall world through a camera we position, stitch the frames into a static tile pyramid, and serve it as the basemap under the existing vector layers. The map currently draws markers on a blank canvas, which is why placed content is extracted but not legible.

## Why the game's own art is not the source

`MapSettings.gameMapTexture` is the obvious candidate and it is a dead end. Probed live against `0.0.10.91`: `settings_overworld` holds a 4x4 white placeholder and `settings_interior` has none. Even fully authored it would be wrong. A prerendered artistic image carries no guarantee of matching current terrain, caps resolution at whatever the artist exported, and has no reliable correspondence to world coordinates.

## The projection is not an open question

An earlier version of this section claimed that our projection might be mirrored against the game's, and used capture as the thing that would dissolve the doubt. The doubt was unfounded, and it rested on a wrong statement about our own pipeline. Measured on 2026-08-15: the game maps `(x, z)` with no sign flip (`Ardenfall/UI/WorldMapUI.cs:410-416`), we map `y: point.z` with no flip (`pipeline/src/entities/location/canonicaliser.ts:188`), and the site renders with `flipY: false`, so screen `y` rises with world `z`. All three agree, and the repo-health audit records the closure.

The comparison with the reference projects still holds as a note about *their* conventions: Ancient Kingdoms documents `deck Y = -game Z` because it renders y-downward. We do not, so we do not negate. Neither choice is wrong; mixing them silently would be.

Capture keeps its own justification: it produces a plate whose world-to-pixel mapping is ours by construction, which removes any future dependence on the game's UI-space factors. It is no longer needed as the answer to a projection doubt.

## Design

**Capture in-game, orthographic, top-down.** Both reference projects converged on this independently. Erenshor's `ChunkRenderer.cs:40-95` sets `orthographic = true`, positions the camera at `(centerX, 1000, centerZ)` with `Quaternion.Euler(90, 0, 0)`, renders to a `RenderTexture`, and calls `ReadPixels` then `EncodeToPNG`. Ancient Kingdoms' `MapScreenshotter.cs:104-145` does the same with a 1024 render texture over 200-unit tiles. Orthographic is required, not stylistic: perspective would make a tileable plate impossible, and Unity applies fog uniformly under orthographic projection.

`unity.screenshot.capture` is already registered by HotRepl Unity Commands, so the primitive exists before the mod grows one.

**Suppress everything non-terrain before rendering.** This is where the real work lives, and Erenshor's `GeometrySuppressor.cs:48-220` is the model: freeze `Time.timeScale`, disable fog and post-processing, hide roofs, then deactivate characters, particles, canvases, nameplates, damage numbers, and world-space text. A capture that includes a wandering NPC is not reproducible.

**Static pyramid, no tile server.** 256-pixel WebP tiles at `/tiles/{map}/{z}/{x}/{y}.webp`, matching the slippy convention and both reference projects. deck.gl's `TileLayer` reads non-geospatial `x/y` from an origin, which is what our `OrthographicView` map already uses.

**Record a checksum per capture run.** Erenshor persists a SHA256 `masterChecksum` and tile count per zone. Without it there is no way to tell a stale capture from a fresh one, and their release plan documents exactly that failure mode.

### Sizing

Measured from placed content in the current artifact, at 2 pixels per world unit:

| map | extent (units) | base tiles | total tiles | zoom levels |
| --- | --- | --- | --- | --- |
| overworld | 1817 x 1654 | 15 x 13 | 272 | 5 |
| interior | 6348 x 5153 | 50 x 41 | 2777 | 7 |

Roughly 3,000 files. Cloudflare Pages allows 20,000 on the free tier and 100,000 paid, so there is an order of magnitude of headroom and resolution is not the binding constraint. The interior figure is pessimistic, since interiors are separate spaces sharing one coordinate range and most of that bounding box is empty. Skipping empty tiles should cut it substantially.

Terrain extent exceeds placed-content extent, so bounds must come from the world geometry, not from `map_points`. Erenshor's incident log records bounds derived too narrowly and clipping content at the edges.

## The constraint this must not break

Adding a marker type to this repo costs **one `map` block in a descriptor**. `mapSourceTables` in `emit-site-metadata.ts:15` switches on `renderKind` and ignores the entity id, layer configuration is `map_layers` rows rather than source literals, and the site's map components contain no switch on layer identity.

Both reference projects lost this, and the numbers are worth stating because they are the reason to defend it:

| project | files touched to add one marker type |
| --- | --- |
| Ardenfall Compendium | 1 |
| Ancient Kingdoms | 17 |
| Erenshor | 20 |

Erenshor restates its type list across extraction listeners, a per-type stable-key method, a manual registry whose comment at `ExportListenerRegistry.cs:162-165` calls itself "the only listener inventory", twelve `get*Markers` query methods, TypeScript unions, icon and colour maps, layer construction, sidebar toggles, URL state, popup and tooltip dispatch, and tests that enumerate the categories again.

Ancient Kingdoms is the sharper warning, because it already has the abstraction. `layers.ts:241-347` defines a generic `createEntityLayer` helper, and `layers.ts:455-1075` then calls it once per hardcoded type. **The helper existed and the architecture defeated it.** A generic renderer does not save you when the list of things to render is restated in seventeen places.

The lesson for this slice: the basemap is itself a map layer. It gets a row, driven by the same data path as every other layer, not a special case threaded through the components.

## Acceptance

- Capture is a mod command driven by the controller, with bounds derived from world geometry per map.
- A capture run is reproducible: same world state in, same checksum out, recorded alongside the tiles.
- Suppression is verified by capturing the same chunk twice with dynamic content present and diffing.
- Tiles are generated as WebP under a documented naming scheme, with empty tiles skipped.
- The basemap renders as a `map_layers`-driven layer. No component gains a branch on layer identity.
- Markers align with terrain at every zoom level, which is the visual proof that the projection question is closed.
- The generated tile count and total bytes are reported by the pipeline, so the Cloudflare file budget stays visible.

## Open

- **Where tiles live.** Committing 3,000 files to git is viable at this size but grows badly on recapture, since every refresh rewrites them. Cloudflare R2 behind a custom domain is the alternative. Decide before the first full run, because moving them later invalidates every URL.
- **Interiors.** They share one coordinate range without occupying it. Either capture per interior space, or capture the shared range sparsely.
- **Lighting seams.** Erenshor's known issue is baked lightmap shadows surviving roof removal, with no fix short of a rebake. Whether Ardenfall has the equivalent is unknown until the first capture.
