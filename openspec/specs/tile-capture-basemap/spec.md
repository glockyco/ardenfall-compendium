# tile-capture-basemap Specification

## Purpose

Defines how the compendium produces a basemap for a map, what a capture must record to be trusted, how tiles are delivered, and how the map renders them.

## Requirements

### Requirement: Capture bounds come from the map's declared grid

A capture MUST take its bounds from the map's declared cell grid, computed from the grid offset, the grid size, and the cell size the game declares for that map. A capture MUST NOT derive bounds from placed content, and MUST NOT read bounds from a value written by hand.

The published bounds MUST contain every placement the compendium publishes for that map. A placement outside the published bounds MUST fail the pipeline.

#### Scenario: A map declares its grid

- **WHEN** a capture starts for a map
- **THEN** its bounds equal the grid rectangle in world units
- **AND** the recorded bounds name the grid offset, grid size, and cell size they came from

#### Scenario: A placement falls outside the captured bounds

- **WHEN** the pipeline ingests a tile set whose bounds exclude a published placement of that map
- **THEN** the pipeline fails with a diagnostic naming the placement and the bounds

### Requirement: A capture renders the world the game streams

A capture SHALL obtain each cell's geometry from the game's own world streamer by moving its focus to that cell, waiting for its queue to drain, and rendering that state. It SHALL NOT load its own scene, instantiate its own distant-cell prefab, or switch off a renderer to hide a second cell copy.

#### Scenario: The player's own cell is captured

- **WHEN** a capture reaches the cell the player stands in
- **THEN** the plate shows that cell as the player sees it from above
- **AND** the capture treats it like every other cell

### Requirement: Every requested grid position is captured

Every position in the requested range SHALL be rendered. There SHALL be no mode that renders only cells shipping an authored scene.

#### Scenario: A cell ships no authored scene

- **WHEN** a capture reaches a grid position with no cell scene in the build
- **THEN** the plate shows what the game streams there: distant terrain, water, or nothing
- **AND** the position is recorded in the tile index

### Requirement: Capture restores streamer focus

A capture SHALL hand the streamer's focus back to the camera and wait for the player's world to be restored before reporting completion.

#### Scenario: The capture ends

- **WHEN** the last cell is rendered
- **THEN** the streamer's focus returns to the camera
- **AND** the export that follows sees the cells the player had before the capture

### Requirement: A capture records every input it depends on

A capture MUST set its own lighting, and MUST NOT depend on the session's time of day, weather, or interior lighting state. A capture MUST record the game build, the map, the grid, the pixels per unit, the camera parameters, the lighting values it set, the culling mask, the pinned time, and the pinned weather.

A rerun with equal recorded inputs MUST produce equal bounds and an equal tile index.

#### Scenario: Two captures share their inputs

- **WHEN** two captures record equal inputs for one map
- **THEN** their bounds are equal
- **AND** their tile index covers the same tile positions

#### Scenario: A capture runs while the world reports no sunlight

- **WHEN** a capture begins while the session's directional light sits at zero intensity
- **THEN** the capture sets its own sun and ambient values
- **AND** the plate is lit by those values rather than by the session

### Requirement: A capture mutates no world state

A capture SHALL exclude transient content through a camera culling mask rather than by deactivating objects.

#### Scenario: Transient content is excluded

- **WHEN** a capture renders a cell containing characters, items, and effects
- **THEN** the plate contains none of them
- **AND** every object in the scene remains active

### Requirement: Culling masks validate named layers

The mask SHALL name its layers and a named layer absent from the build SHALL fail the capture, because `LayerMask.GetMask` counts an unknown name as nothing and would silently retain excluded content.

#### Scenario: The mask names a layer the build lacks

- **WHEN** a capture starts against a build that has no layer of a name the mask uses
- **THEN** the capture fails and names the missing layer
- **AND** no plate is written

### Requirement: Unavoidable capture changes are restored and reported

When a capture cannot express an exclusion as a layer, it SHALL restore what it changed before returning and report what it changed.

#### Scenario: A non-layer exclusion changes the world

- WHEN capture must change state for an exclusion that no layer can express
- THEN it restores that state before returning and reports the change

### Requirement: Capture preserves subsequent export data

An export after capture in the same session SHALL produce the same data as an export without capture.

#### Scenario: An export follows a capture in one session

- **WHEN** an export runs after a capture in the same session
- **THEN** its snapshot matches an export from a session with no capture

### Requirement: Tiles are published as content-hashed assets with a generated index

Each tile SHALL publish through the asset path used for every other image, named by its content hash and recorded in the artifact manifest. The pipeline SHALL emit an index resolving a map, zoom level and tile position to that asset and its byte size.

#### Scenario: A tile reaches the site

- **WHEN** the pipeline ingests a capture
- **THEN** each tile is an asset named by its content hash
- **AND** the tile index resolves its map, zoom, and position to that asset
- **AND** the artifact manifest records it

### Requirement: Tile and map zoom share one producer

The finest tile zoom level SHALL match the map view's maximum allowed zoom, with both coming from one producer.

#### Scenario: Finest zoom is published

- WHEN tile metadata and the map view define their maximum zoom
- THEN both consume the same producer and their maximum zoom levels match

### Requirement: Tile indexes cover every bounded position

A tile position inside published bounds that the index does not resolve SHALL fail the pipeline. A position with nothing to render SHALL be recorded as empty rather than silently omitted.

#### Scenario: A tile is missing inside the published bounds

- **WHEN** the index lacks a tile position that the published bounds contain
- **THEN** the pipeline fails with a diagnostic naming the map, zoom, and position

#### Scenario: A region holds nothing to render

- **WHEN** a tile position inside the bounds contains no geometry
- **THEN** the index records that position as empty
- **AND** the map renders no tile there

### Requirement: The map renders the basemap from generated metadata

The pipeline MUST publish basemap metadata per map, carrying the bounds, the pixels per unit, the zoom range, the tile size, and the tile index reference. The basemap MUST NOT be declared by an entity descriptor, because it belongs to no entity.

The map MUST render the basemap beneath every marker layer. No map component may branch on layer identity, including the basemap.

The site MUST NOT transform a coordinate. The basemap MUST use the map coordinates the pipeline already publishes.

#### Scenario: A map view carries a basemap

- **WHEN** the site loads a map that publishes basemap metadata
- **THEN** it renders the basemap below the marker layers
- **AND** it positions tiles from the published bounds and pixels per unit

#### Scenario: A map publishes no basemap

- **WHEN** a map has no captured tile set
- **THEN** the map renders its markers with no basemap
- **AND** no component fails

### Requirement: Capture output is reported with its provenance

The pipeline MUST report, per map, the tile count, the total tile bytes, the published bounds, the pixels per unit, and the game build the capture ran against. A capture whose game build differs from the snapshot's game build MUST fail the pipeline.

#### Scenario: A capture is reported

- **WHEN** the pipeline finishes ingesting a capture
- **THEN** its report names the map, bounds, pixels per unit, tile count, total bytes, and game build

#### Scenario: A capture and a snapshot disagree about the build

- **WHEN** a tile set records a different game build from the snapshot being published
- **THEN** the pipeline fails with a diagnostic naming both builds
