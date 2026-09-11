## Why

The map draws markers on a blank canvas. Placed content is extracted and published, and a reader cannot tell a coastal ruin from an inland one, because nothing renders the world under the markers.

A live session against Ardenfall Demo `0.0.10.91` measured what the game holds. The measurements changed this plan, so each one appears in `design.md` with the expression that produced it.

- The overworld map declares a cell grid of 25 by 23 cells at 150 world units. The interior map declares 12 by 9 cells at 600 units. Grid bounds contain every published placement of both maps.
- The build ships 27 cell scenes: 24 overworld cells in one 6 by 4 block, and 3 interior cells that do not touch. It also ships 575 distant-cell prefabs, one per overworld grid cell.
- 83 of 373 published placements fall inside an authored cell scene. All 373 fall inside the declared grids.
- The game generates its own top-down map imagery: 12 parts of 2048 by 2048 pixels, normal size 6250 by 5750 pixels over 3750 by 3450 units, which is 1.667 pixels per unit on both axes.
- An orthographic top-down capture works in the running game. A camera, a render texture, `ReadPixels`, and `EncodeToPNG` produced a legible plate of two loaded overworld cells at 3.4 pixels per unit.
- Lighting does not follow from the clock. With the player inside an interior, the sun sits at intensity 0, and forcing the game's sky update keeps it at 0.

An earlier draft of this plan rejected the game's imagery after probing `MapSettings.gameMapTexture`, which the map UI never reads, and it sized the work from the extent of placed content after stating that terrain exceeds that extent. Both errors are corrected here.

## What Changes

- Capture each map from an orthographic top-down camera in the running game, driven by the controller.
- Take capture bounds from the map's declared cell grid, never from placed content and never from a hand-written constant.
- Let the capture establish its own lighting, and record every input it pins. A capture must not inherit the save's time, weather, or interior lighting state.
- Suppress transient content with a camera culling mask, so the capture mutates no world state and restores nothing.
- Consume the world walk from `world-cell-content` to reach cell geometry. No overworld geometry exists in memory until that load path runs.
- Publish each tile as a content-hashed asset through the existing asset path, and emit a tile index that resolves a map, zoom, and tile position to an asset.
- Render the basemap from generated map metadata beneath the marker layers. The basemap is not an entity, so it gets no descriptor.
- Report tile count, bytes, and capture provenance per map.

**BREAKING** for the map read model: the map view gains basemap metadata, and the site reads it.

The following decisions remain open, and `design.md` states the alternatives.

- Capture resolution in pixels per unit, which drives file count quadratically.
- Whether interiors are captured with their ceilings removed, and how.
- Whether the game's own generated imagery is published as an alternative layer and used as an alignment reference.
- Whether the capture covers grid cells that have no authored scene, where only distant-cell geometry exists.

## Capabilities

### New Capabilities

- `tile-capture-basemap`: capture bounds from declared grids, capture-owned lighting, non-destructive suppression, content-hashed tiles with a generated index, and a basemap the map renders from metadata.

### Modified Capabilities

- `placement-map`: the map view publishes basemap metadata beside its layers.
