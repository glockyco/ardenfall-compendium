## Purpose

Defines the traversal that harvests authored objects from the game's cell scenes, the identity it gives them, the guarantees it makes about leaving the game unchanged, and what it reports.

## ADDED Requirements

### Requirement: The cell inventory comes from loadable scenes

The walk MUST enumerate cell scenes from the build settings and MUST confirm each is loadable before attempting it. A cell asset with no scene MUST be counted as having no authored objects rather than treated as a failure.

#### Scenario: The inventory matches the build

- **WHEN** the walk plans its work
- **THEN** it lists the cell scenes present in build settings, currently 27 of 33 scenes
- **AND** it confirms each with the engine's streamed-level check
- **AND** it reports how many cell assets have no scene, currently 580 of 607

#### Scenario: A missing scene is not an error

- **WHEN** a cell asset has no corresponding scene
- **THEN** the walk skips it without a diagnostic
- **AND** the count of skipped cells appears in the report

### Requirement: The walk runs in batches across frames

The walk MUST load scenes additively, in build-index order, a bounded number at a time, and MUST harvest and unload each scene before its slot is reused. It MUST be driven by a command that spans frames and reports progress, rather than by a single blocking call.

#### Scenario: Progress is observable

- **WHEN** a walk runs
- **THEN** each batch reports the cells harvested, the cells in flight and the cells pending
- **AND** an interrupted walk can resume from the pending list

#### Scenario: Order is stable

- **WHEN** two walks run against the same build
- **THEN** they visit cells in the same order
- **AND** they harvest the same objects

### Requirement: A harvested object is identified by the game's GUID

Every harvested object MUST take its identity from `GuidComponent.GuidString`, expressed so the id declares the mechanism. An object with no GUID or an empty one MUST be diagnosed and skipped, and MUST NOT receive a positional or hierarchy-path identity.

#### Scenario: An object with a GUID is identified

- **WHEN** the walk harvests an object carrying a non-empty GUID, which applies to 140 of 142 content objects in the richest sampled cell
- **THEN** its canonical id is derived from that GUID and names the scene mechanism
- **AND** the id is stable across walks

#### Scenario: An object without a GUID is reported

- **WHEN** a harvested object carries no GUID or an empty one
- **THEN** the walk emits a diagnostic naming the cell and the component type
- **AND** the object is not published

### Requirement: The walk leaves the game as it found it

The walk MUST restore `Application.backgroundLoadingPriority`, MUST unload every scene it loaded, MUST NOT write save state, and MUST NOT create records. It MUST prove the last point rather than assume it.

#### Scenario: Loading priority is restored

- **WHEN** a walk completes or fails
- **THEN** the engine's background loading priority equals its value before the walk

#### Scenario: Scenes are unloaded

- **WHEN** a walk completes
- **THEN** the only cell scenes loaded are those that were loaded before it started

#### Scenario: Record counts are unchanged

- **WHEN** a walk completes
- **THEN** the record count for every record type equals its count before the walk
- **AND** the run fails when any count differs

### Requirement: The walk reports its cost and its coverage

The run manifest MUST record, per cell, the objects seen and the modelled objects harvested, and MUST record component types the walk saw but does not model.

#### Scenario: Per-cell coverage is reported

- **WHEN** a walk completes
- **THEN** the manifest lists each cell with its object count and its harvested count
- **AND** it lists which cells held no content, currently 12 of 27

#### Scenario: An unmodelled type is visible

- **WHEN** the walk encounters a component type it does not model, such as `BubbleElevatorSpawner`
- **THEN** the manifest records the type and how many instances it saw
- **AND** the walk does not fail
