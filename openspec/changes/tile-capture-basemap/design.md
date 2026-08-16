## Context

See proposal.md for the motivation. This document holds the measurements that shaped the plan, and the decisions that follow from them.

Every measurement below comes from one live session against Ardenfall Demo `0.0.10.91` on 2026-08-16, driven through the HotRepl CLI. A probe targets one game build and decays with that build. Repeat a probe before trusting it against a later build.

The evaluator accepts one expression, so each probe is an invoked lambda: `new System.Func<string>(() => { … })()`.

### What the game declares

| Fact                  | Value                                                                               | Probe                                                                    |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| overworld grid        | `gridOffset` (-18, -10), `gridSize` (25, 23), `cellSize` 150                        | `Resources.FindObjectsOfTypeAll<WorldData>()[0].maps`                    |
| interior grid         | `gridOffset` (-6, -2), `gridSize` (12, 9), `cellSize` 600                           | same                                                                     |
| interior terrain      | `enableTerrain` false                                                               | same                                                                     |
| cell records          | 607 total: 575 overworld, 32 interior                                               | `Resources.FindObjectsOfTypeAll<CellData>()` grouped by `map.id`         |
| cell scenes in build  | 27: 24 overworld in x -5..0 and z -10..-7, and interiors at (-6,-2), (-6,6), (4,-2) | `SceneUtility.GetScenePathByBuildIndex` over `sceneCountInBuildSettings` |
| distant-cell prefabs  | overworld 575, interior 0                                                           | `MapData.GeneratedAssetReferences.distantCellPrefabs`                    |
| generated map imagery | overworld 12 parts of 2048², normal size (6250, 5750); interior none                | `GeneratedAssetReferences.stitchedMapTextureParts`                       |
| cell world origin     | offset coordinate times `cellSize`, at the cell corner                              | `cell_overworld_-3.-8` reported position (-450, 0, -1200)                |

Grid bounds follow: overworld x -2700 to 1050 and z -1500 to 1950; interior x -3600 to 3600 and z -1200 to 4200.

### What the reader needs covered

Published placements from release `0.0.10.91-20260816-1023292829440`: overworld markers span x -1573 to 247 and z -1129 to 534; interior markers span x -3412 to 2936 and z -1158 to 3995. Every marker of both maps lies inside its declared grid. 83 of 373 lie inside an authored cell scene.

### What a capture produced

A camera with `orthographic = true`, `orthographicSize = 75`, position (-300, 1200, -1125), rotation (90, 0, 0), a 1024 by 512 render texture, and a culling mask excluding UI, NPC, player, item, and damageable layers rendered two loaded overworld cells into a fully opaque plate showing coastline, sand, foliage, a road, and structures. `ImageConversion.EncodeToPNG` returned 433,796 bytes.

The same probe with the world time pinned to 12:00 and `timeMultiplier` set to 0 produced an almost identical plate. `ArdenfallSkybox.instance.ForceUpdate()` set the sun to intensity 0 pointing straight down. The player stood inside an interior throughout, and the game kills outdoor light in that state.

### What the stitched imagery shows

The 12 parts were exported and assembled on 2026-08-16. Part positions are measured from the bottom of the plane, so north sits at the image top, and the mapping is:

```
px_x = (world_x + 2700) * 5 / 3
px_y = 5750 - (world_z + 1500) * 5 / 3
```

That mapping was confirmed against a capture rather than assumed. The plate captured at world x -450 to -150 and z -1200 to -1050 matches the same region of the stitched imagery feature for feature, in the same orientation.

All 278 published overworld markers were then drawn on the assembled image at those pixel positions. Every one lands on detailed terrain: characters in settlements and along roads, locations on named sites, portals at path junctions. None falls in the ocean, and none falls on flat ground.

The imagery carries detail across the whole grid, including regions whose cell scenes the demo build does not ship. The 24 authored cells occupy pixels 3250, 4750 with size 1500 by 1000, which is the southern coastal strip alone. The two marker clusters in the north-west and the south-east sit on terrain that no cell scene in this build can render.

### What a full capture of the loadable cells produced

Run on 2026-08-16 against the same build. All 24 authored overworld cells were loaded, and each was rendered to 1024 pixels, which is 6.83 pixels per unit, or four times the resolution of the shipped imagery. The stitched result covers 900 by 600 units at 6144 by 4096 pixels, and weighs 20 MB as PNG and 2 MB as WebP.

The recipe that produced a usable plate, in order:

1. Load `map_<id>` and each cell scene. The skybox lives in the map scene, so `ArdenfallSkybox.instance` is null until the map scene loads.
2. Pin the clock. Set `timeMultiplier` to 0, then call `SetTime`.
3. Start `weather_clear` with `instant` true, then disable the weather manager. Region weather re-randomises otherwise, and a re-randomised weather returned a sun intensity of 0 in the middle of this spike.
4. Force one sky update, then disable the skybox component, then set the sun's intensity, colour, angle, and shadow mode. The skybox recomputes the light every frame from time and weather, so it overwrites anything set while it runs.
5. Swap the water renderers to a flat unlit material. `Universal Render Pipeline/Unlit` exists in the build, and `Unlit/Color` is stripped.
6. Render each cell with a culling mask that excludes UI, post-processing, items, damageables, the player, characters, and weather collision.
7. Restore the water materials, the weather manager, and the skybox.

Three findings that a capture must handle, and that the shipped imagery already handles:

- **Water cannot be captured as it renders in game.** The `Ardenfall/Water` shader on layer 4 renders nothing into an ad-hoc camera, and with the shader present the surface blows out to white, because a top-down camera sees the sun mirrored. Painting water with a flat material is the controllable answer, and its colour is ours to choose.
- **Underwater foliage renders black from above** and dominates every water area. Kelp and seagrass share the detail and grass layers with land grass, so a culling mask cannot separate them. Suppression must select by height against the water plane, or by renderer.
- **A capture's colour does not match the shipped imagery**, because our pinned sun and ambient differ from the editor's. Either calibrate against the imagery, which shares the grid, or accept a different look and state that it is ours.

The comparison at equal scale is decisive on resolution and unfinished on cleanliness. The capture resolves individual rocks, jetty planks, and building footprints that the imagery blurs, while the imagery has clean blue water, no black foliage, and even lighting.

## Goals and non-goals

**Goals**

- A basemap under the markers, for every map the compendium publishes.
- Bounds and tile positions that follow from data the game declares.
- A capture whose result depends only on inputs it records.
- Delivery through the asset path that already ships icons.

**Non-goals**

- A second world-to-map transform. `pipeline/src/entities/location/canonicaliser.ts` owns it.
- A tile server, a runtime image service, or a Worker route.
- Capturing transient content: characters, effects, weather, or the player.
- Building a world loader. `world-cell-content` owns cell traversal.

## Decisions

### 1. Bounds come from the declared grid

`MapData.gridOffset`, `MapData.gridSize`, and `MapSettings.cellSize` give each map a rectangle in world units. The capture uses that rectangle.

Two other candidates were rejected. Placed-content bounds move whenever content moves, and they omit terrain a reader can see; the earlier draft used them and undersized the overworld. A hand-written constant is what Ancient Kingdoms does in `MapScreenshotter.cs`, where bounds x -880 to 900 and z -740 to 1300 live in source, and what Erenshor does per zone in `zone-capture-config.json`. Both must be re-measured by hand whenever the game changes.

The game's own imagery confirms the rectangle: 6250 by 5750 pixels over 3750 by 3450 units is 1.667 pixels per unit on both axes, so the generator used the same grid.

### 2. The capture owns its lighting

Measured: the sun sits at intensity 0 while the player is inside an interior, and forcing the sky update does not change that. A capture that inherits game lighting therefore depends on where the player stands, which is not an input anyone records.

The capture sets a fixed sun direction, sun intensity, ambient value, and fog state, disables post-processing, and records each value. Two captures of one cell agree because their inputs agree, not because the save happened to match.

The game's own generated imagery is evenly lit with no shadows and no time of day, which is the same conclusion reached by its authors.

### 3. Suppression uses a culling mask

`LayerUtility` names the layers: Water 4, postProcess 12, NoInteriorLight 13, Door 15, Item 16, Damagable 17, Player 18, NPC 19, WeatherCollision 20, Element 21, details 22 and 23, grass 6.

A culling mask excludes a layer for one camera and mutates nothing. Deactivating objects, which `GeometrySuppressor.cs` does in Erenshor and `MapScreenshotter.cs` does in Ancient Kingdoms, leaves the world in a modified state; Ancient Kingdoms documents that its `ShowEntities` is never called. A capture inside an export session must not damage the session that follows it.

Interiors need their ceilings removed to be legible from above, and a ceiling may not have a layer of its own. That is the open question in decision 8.

### 4. Reproducibility means recorded inputs, not identical bytes

A GPU render is not bit-stable across drivers, frames, or streaming state. A requirement for identical bytes would fail on first contact and then be weakened, so it is not written.

Instead the capture records its inputs and its inventory: game build, map, grid, pixels per unit, camera parameters, lighting values, culling mask, pinned time, pinned weather, and the cell scenes loaded. A rerun with equal inputs must produce equal bounds and an equal tile index. Tile content is compared with a tolerance when it is compared at all.

Erenshor's `masterChecksum` in `state.py` is a skip guard for re-running a capture, not a claim about pixel equality. This plan keeps that meaning.

### 5. Tiles are content-hashed assets with a generated index

The repository already carries images end to end. `SpriteAssetExporter` writes `assets/{entityId}/{sha256}.png`, `emit-assets.ts` converts each to `assets/{sha256}.webp`, the artifact manifest records the asset tree hash, `stage-artifact.ts` copies the tree into the published directory, and the site requests `/assets/{hash}.webp`.

Tiles ride that path. A generated `map_tiles` index resolves map, zoom, and tile position to an asset hash and byte size.

This dissolves two problems the earlier plan carried. A path scheme of `/tiles/{map}/{z}/{x}/{y}.webp` needs cache invalidation on recapture, while a content-hashed asset never goes stale. And a tile index emitted from the same snapshot as the markers cannot disagree with them, so the browser needs no freshness check. The earlier requirement asked a renderer to compare a geometry checksum before rendering, which the site cannot do: it holds no geometry.

The choice between a repository directory and an external bucket also disappears, because tiles become artifact assets like every other image. Committing generated output is already prohibited.

### 6. The basemap is map metadata, not a descriptor-declared layer

`map_layers.entity_id` is `NOT NULL`, and every row belongs to an entity descriptor whose `map` block declares it. A basemap has no entity, so publishing it as a layer row would require inventing an entity that nothing else uses.

The basemap therefore belongs to the map's own metadata, emitted per map id beside the layer rows, carrying bounds, pixels per unit, zoom range, tile size, and the index reference.

The invariant the earlier plan defended still holds, and it is worth restating because both reference projects lost it. Adding a marker type here costs one `map` block in one descriptor. Ancient Kingdoms has a generic `createEntityLayer` helper in `layers.ts` and then calls it once per hardcoded type; the helper existed and the architecture defeated it. No map component may branch on layer identity, and that includes the basemap.

### 7. Resolution is the cost driver

File count grows with the square of pixels per unit. Tiles are 256 pixels. The deploy gate fails above 20,000 files, and the live build currently ships 7,373.

| pixels per unit                              | overworld files | interior files | total | share of remaining budget |
| -------------------------------------------- | --------------- | -------------- | ----- | ------------------------- |
| 1.667, matching the game's imagery           | 790             | 63             | 853   | 7%                        |
| 3.33                                         | 2,995           | 255            | 3,250 | 26%                       |
| 5                                            | 6,742           | 579            | 7,321 | 58%                       |
| 6.83, the spike's value, authored cells only | 512             | 63             | 575   | 5%                        |

Interior counts assume the three authored cells only, since interiors have no distant geometry and 105 of 108 grid cells hold nothing.

Two further constraints belong to this decision. The pyramid's finest level should match the map's maximum zoom, because a tile finer than the viewer allows is never requested; the viewer's zoom cap and the tile resolution are one fact with one producer. And the plate at 3.4 pixels per unit that this session captured is the only sample of legibility so far, so the choice needs one comparison at two resolutions before it is made.

### 8. Open decisions

**Capture resolution.** The spike settles legibility: 6.83 pixels per unit resolves detail the shipped imagery loses, and capturing only the authored cells at that resolution costs about 512 files. Capturing the full grid at that resolution costs about 12,300 files, which exceeds the deploy headroom and buys nothing where no cell scene exists. The open part is the pairing rather than the number: high resolution over authored cells, and what covers the rest.

**Interior ceilings.** An interior captured from above shows its roof. Options: exclude a ceiling layer if one exists, disable renderers tagged by `InteriorFilterVolume` for the duration of a capture and accept a mutation that must be undone, or capture interiors from a height below the ceiling. The first is preferred and its feasibility is unmeasured.

**The game's own imagery.** It exists at 1.667 pixels per unit with placement and scale arrays, is evenly lit, needs no capture, and aligns exactly with the grid and with our own capture. Against this build it also covers every marker, while a capture covers one cluster of three.

Options: publish the imagery as the basemap for a build whose cell scenes cover little of the world, and let a capture supersede it per cell as authored coverage grows; publish it as an alternative layer beside a captured basemap; or use it only as an alignment reference. The first is the measured recommendation and the decision is the reader's to make, because the second and third ship a basemap with terrain under a fifth of the markers.

**Cells without an authored scene.** 24 of 575 overworld cells ship a scene, and only 83 of 373 placements sit inside one. Distant-cell prefabs cover the rest at lower detail, and the marker overlay shows that the two largest clusters lie outside every authored cell. Options: capture the full grid and accept two fidelity levels in one plate, capture only authored cells and leave the remainder blank, or capture the full grid and record which cells were authored so the map can mark the difference. A reader who sees terrain expects it to be real, so the third option is the honest one and it costs a flag per cell.

## Risks and trade-offs

- The capture depends on `world-cell-content`. Until that walk exists, no overworld geometry can be reached, and this change cannot start.
- Distant-cell geometry differs in detail from authored geometry, so a full-grid plate is not uniform. Decision 8 addresses it.
- Lighting is set by us, so the basemap will not match a screenshot a player takes. That is intended: a map is not a screenshot.
- Interior maps share one coordinate plane while occupying three separate patches of it. The tile index is sparse, and the map must not imply terrain between them.
