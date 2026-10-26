# entity-extraction Specification

## Purpose

Defines how the live game produces structured snapshot data and how the pipeline accepts or rejects a run.

## Requirements

### Requirement: The live runtime is the structured extraction source

`mod/src/Control/Handlers/RunFinalizeCommand.cs` MUST obtain structured rows from live-game extraction caches. The extraction path MUST NOT use an offline asset extractor as a second structured source.

#### Scenario: A live run supplies rows

- **WHEN** the finalize command requests entity rows
- **THEN** it obtains rows from the configured extraction caches
- **AND** the pipeline receives those rows through the snapshot files loaded by `pipeline/src/stages/load-snapshot.ts`

### Requirement: The entity registry owns pipeline dispatch

`pipeline/src/entities/registry.ts` MUST remain the sole dispatch registry for canonicalisers, read-model emitters, and map projections. Its `validateDescriptorCoverage` function MUST reject a descriptor without the emitter required by its route or map metadata.

#### Scenario: A descriptor lacks dispatch coverage

- **WHEN** `validateDescriptorCoverage` checks a descriptor with a site route but no read-model emitter
- **THEN** it throws an error naming the descriptor and route
- **AND** SQLite emission does not continue through `pipeline/src/stages/emit-sqlite.ts`

### Requirement: Record-backed families use record extraction

`mod/src/Entities/Portal/MasterRecordTablePortalRecordSource.cs` MUST read record-backed rows from the live master record table. Record-backed extraction MUST remain separate from lookup-asset extraction.

#### Scenario: A portal record is extracted

- **WHEN** the portal extractor enumerates portal records
- **THEN** it reads `PortalRecord` values from the master record table
- **AND** it emits the record identity and fields through `mod/src/Entities/Portal/PortalExtractor.cs`

### Requirement: Preflight gates snapshot creation

`mod/src/Preflight/Preflight.cs` MUST check live game readiness immediately before finalization. `mod/src/Control/Handlers/RunFinalizeCommand.cs` MUST stop before staging a snapshot when preflight fails.

#### Scenario: Preflight fails

- **WHEN** any required readiness check returns not ready
- **THEN** the finalize command returns `preflightFailed`
- **AND** it writes no snapshot directory

### Requirement: Snapshot publication is atomic

`mod/src/Control/Handlers/RunFinalizeCommand.cs` MUST stage entity envelopes and their manifest before publication. It MUST move the completed staging directory into the published snapshot directory only after all writes succeed.

#### Scenario: Finalization succeeds

- **WHEN** all entity extraction and artifact writes succeed
- **THEN** the run publishes one snapshot directory containing entity envelopes and `manifest.json`
- **AND** the manifest preserves diagnostic totals
- **AND** `diagnostics.json` is written when the run produces diagnostics

#### Scenario: Finalization fails during writing

- **WHEN** an artifact write raises an error
- **THEN** the command removes the staging directory
- **AND** it does not publish a partial snapshot

### Requirement: An export proves which plugin answered

`compendium.preflight` SHALL report the running plugin assembly's location, SHA-256, last write time, and Unity product name. The digest SHALL be read while the assembly loads, because deploying into a running game replaces the file and a later read would identify the deployed build as the running one.

#### Scenario: Preflight reports the loaded assembly

- WHEN a plugin assembly loads and later answers preflight
- THEN preflight reports its load-time SHA-256, assembly location, last write time, and Unity product name

### Requirement: Export rejects the wrong plugin or product

The controller SHALL compare the running digest with the plugin deployed to the main game and fail the export on mismatch or when the product is not `Ardenfall Alpha`. Comparison SHALL NOT rest on a hard-coded plugin version.

#### Scenario: A stale instance is rejected

- **WHEN** the answering game runs a plugin whose digest differs from the deployed main-game plugin
- **THEN** the export fails before it extracts anything
- **AND** the message names both digests and the deployed path

#### Scenario: The deployed instance is accepted

- **WHEN** the main game runs the deployed plugin
- **THEN** preflight passes
- **AND** the manifest records the plugin digest beside the game build

#### Scenario: A deploy into a running game does not change what the game reports

- **WHEN** the plugin file is replaced while the game runs
- **THEN** the running plugin still reports the digest it was loaded with
- **AND** the next export fails on the mismatch

#### Scenario: A missing identity is a failure, not a skip

- **WHEN** preflight reports no plugin identity or product name
- **THEN** the export fails
- **AND** the run does not fall back to a plugin version or path alone

### Requirement: Snapshots retain portable plugin identity

The digest and product identity SHALL reach the snapshot manifest so it names the mod and game that produced it. The manifest SHALL NOT carry the machine-specific plugin path.

#### Scenario: A manifest identifies its producer

- WHEN a snapshot is published
- THEN its manifest records the plugin digest and product identity
- AND it omits the plugin path
