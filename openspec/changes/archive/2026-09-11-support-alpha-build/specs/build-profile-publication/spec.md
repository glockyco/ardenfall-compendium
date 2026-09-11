## Purpose

Defines how the compendium extracts, publishes, and identifies the current main Ardenfall game as its sole supported data source.

## ADDED Requirements

### Requirement: The main game is the only supported source

The toolchain MUST accept the Unity product `Ardenfall Alpha` as its sole live extraction and publication source. It MUST reject the Demo and every unknown product before entity extraction starts.

The selected installation, game assemblies, plugin deployment, HotRepl endpoint, snapshot output, and release input MUST form one main-game configuration. Missing configuration MUST fail instead of falling back to a Demo path.

#### Scenario: The main game answers

- **WHEN** extraction connects to `Ardenfall Alpha` with the configured plugin and endpoint
- **THEN** preflight permits the run
- **AND** every output records the main-game identity

#### Scenario: The Demo answers

- **WHEN** extraction connects to `Ardenfall Demo 2025`
- **THEN** preflight rejects it before writing entity data
- **AND** the diagnostic states that the main game is required

### Requirement: The extractor targets the main game API

The extraction mod MUST compile against the configured main-game assemblies. Every registered entity family and command MUST produce the canonical contract expected by the pipeline.

The build MUST NOT include a Demo compatibility target, conditional Demo adapter, reflection fallback, or skipped family used only to tolerate API differences between the old and current games.

#### Scenario: The extractor builds

- **WHEN** repository verification builds the mod
- **THEN** it resolves the main game's assemblies
- **AND** all registered families and commands compile against that API

#### Scenario: A game API changed from the Demo

- **WHEN** the main game exposes a different member or signature
- **THEN** shared extraction code uses the current typed API
- **AND** the canonical snapshot contract remains valid

### Requirement: Main-game identity follows snapshots and releases

A snapshot and every release artifact built from it MUST record the Unity product name, game version, build identifier, and extractor digest. Publication MUST proceed only when those values prove the snapshot came from the supported main game.

#### Scenario: A main-game snapshot becomes a release

- **WHEN** a main-game snapshot with complete matching provenance passes validation
- **THEN** the pipeline creates a release artifact
- **AND** the artifact retains that source identity

#### Scenario: Source identity is absent or unsupported

- **WHEN** publication receives a snapshot without complete identity or from another product
- **THEN** publication fails
- **AND** no release artifact is produced

### Requirement: The interactive site uses one main-game release

The site build MUST expose the source identity of its staged release. The map basemap, layer metadata, markers, search rows, and detail links MUST all come from that release artifact.

#### Scenario: A reader opens the main-game map

- **WHEN** the site is built from a main-game release and the reader opens `/map`
- **THEN** the page identifies the main game
- **AND** its terrain and markers resolve from the same release

#### Scenario: A stale Demo artifact is staged

- **WHEN** site staging receives a Demo artifact or files left from another release
- **THEN** staging fails before the site build
- **AND** the diagnostic names the conflicting source
