## Purpose

Defines reproducible terrain capture, static tile delivery, geometry freshness checks, and descriptor-driven basemap rendering.

## ADDED Requirements

### Requirement: A capture run derives a deterministic tile set from world geometry

A controller-driven capture command MUST derive bounds from the game's terrain geometry for each map. It MUST use an orthographic top-down projection. The capture MUST make the world-to-map mapping ours by construction. World x MUST map to map x. World z MUST map to map y. World y MUST map to elevation. A repeated run against the same geometry and capture state MUST produce the same tile content.

#### Scenario: A map is captured from its terrain

- **WHEN** the controller starts a capture for a map
- **THEN** the command derives the capture bounds from world geometry
- **AND** it renders an orthographic top-down tile set
- **AND** the resulting tiles use the world x, z, and y mapping stated above

#### Scenario: The same geometry is captured twice

- **WHEN** two runs use the same geometry and capture state
- **THEN** they produce identical tile bytes and bounds

### Requirement: A tile set is rejected when its geometry is stale

Each capture run MUST record a checksum of the geometry used to produce its tile set. A renderer MUST compare that checksum with the current map geometry before it uses the tile set. A mismatch MUST fail the basemap load rather than render stale terrain.

#### Scenario: A matching tile set is loaded

- **WHEN** the recorded geometry checksum equals the current geometry checksum
- **THEN** the basemap is eligible to render

#### Scenario: A stale tile set is requested

- **WHEN** the recorded geometry checksum differs from the current geometry checksum
- **THEN** the basemap load fails with a stale-capture diagnostic
- **AND** no stale tile is rendered

### Requirement: Capture output excludes runtime overlays

Before rendering, the capture MUST suppress time progression, fog, post-processing, roofs, characters, particles, canvases, nameplates, damage numbers, and world-space text. The capture MUST verify suppression by comparing captures of matching terrain while dynamic content is present.

#### Scenario: Dynamic content is present during capture

- **WHEN** the same terrain is captured twice with dynamic content present
- **THEN** the suppression verification finds no output difference caused by those listed overlays
- **AND** the capture restores the runtime state after verification

### Requirement: Tiles use a static WebP pyramid

The capture MUST write WebP tiles under `/tiles/{map}/{z}/{x}/{y}.webp`. The delivery path MUST serve those files as static assets without a Worker. Empty tiles MUST be omitted. The published bounds MUST remain available even when empty tiles are omitted.

#### Scenario: A non-empty tile is published

- **WHEN** a rendered tile contains terrain
- **THEN** it is written as a WebP file at the documented pyramid path
- **AND** the static delivery path can serve it without Worker execution

#### Scenario: A tile contains no terrain

- **WHEN** a tile contains no rendered terrain
- **THEN** the tile file is omitted
- **AND** the geometry-derived bounds still describe that tile's position in the pyramid

### Requirement: The basemap is a descriptor-declared map layer

The pipeline MUST publish the basemap through the existing descriptor-declared layer contract and `map_layers` data path. The map MUST consume the basemap from that generated layer metadata. Map components MUST NOT branch on basemap identity.

#### Scenario: A descriptor declares the basemap

- **WHEN** site metadata emission processes a descriptor with a basemap layer
- **THEN** it publishes the basemap layer through `map_layers`
- **AND** the map loads it through the same layer metadata path as other layers
- **AND** no map component needs a basemap-specific branch

### Requirement: The pipeline reports tile output

The pipeline MUST report the generated tile count and total tile bytes for each capture output. The report MUST identify the map and capture geometry checksum.

#### Scenario: A capture is reported

- **WHEN** the pipeline ingests a completed tile set
- **THEN** its report includes the map, geometry checksum, tile count, and total WebP bytes
