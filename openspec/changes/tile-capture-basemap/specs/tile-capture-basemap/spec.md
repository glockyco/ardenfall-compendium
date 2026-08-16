## Purpose

Defines how the compendium produces a basemap for a map, what a capture must record to be trusted, how tiles are delivered, and how the map renders them.

## ADDED Requirements

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

### Requirement: A capture records every input it depends on

A capture MUST set its own lighting, and MUST NOT depend on the session's time of day, weather, or interior lighting state. A capture MUST record the game build, the map, the grid, the pixels per unit, the camera parameters, the lighting values it set, the culling mask, the pinned time, the pinned weather, and the cell scenes it loaded.

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

A capture MUST exclude transient content with a camera culling mask rather than by deactivating objects. Where a capture cannot express an exclusion as a layer, it MUST restore what it changed before it returns, and MUST report what it changed.

After a capture, an export running in the same session MUST produce the same data it produces without a capture.

#### Scenario: Transient content is excluded

- **WHEN** a capture renders a cell containing characters, items, and effects
- **THEN** the plate contains none of them
- **AND** every object in the scene remains active

#### Scenario: An export follows a capture in one session

- **WHEN** an export runs after a capture in the same session
- **THEN** its snapshot matches an export from a session with no capture

### Requirement: Tiles are published as content-hashed assets with a generated index

Each tile MUST be published through the asset path that carries every other image, named by the hash of its content and recorded in the artifact manifest. The pipeline MUST emit a tile index that resolves a map, a zoom level, and a tile position to that asset and its byte size.

The finest zoom level MUST match the maximum zoom the map view allows, and both MUST come from one producer.

A tile position inside the published bounds that the index does not resolve MUST fail the pipeline. A position with nothing to render MUST be recorded as empty rather than omitted silently.

#### Scenario: A tile reaches the site

- **WHEN** the pipeline ingests a capture
- **THEN** each tile is an asset named by its content hash
- **AND** the tile index resolves its map, zoom, and position to that asset
- **AND** the artifact manifest records it

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
