## Purpose

Defines release identity, cross-release comparison, and archive retrieval for repeatable snapshot review.

## ADDED Requirements

### Requirement: A release carries a committed summary digest

Every release MUST include a committed machine-readable digest. The digest MUST identify the game version, build identifier, extractor version, and every extracted family count. It MUST identify the release artifact and the source snapshot.

#### Scenario: A release digest records its source and coverage

- **WHEN** a live-game release is published
- **THEN** its archived files include one digest that names the game version and build identifier
- **AND** the digest lists a count for each extracted family
- **AND** the digest identifies the release artifact and source snapshot

#### Scenario: A missing family count blocks publication

- **WHEN** a release digest omits a family declared by the source snapshot
- **THEN** release publication fails
- **AND** the failure names the missing family count

### Requirement: A comparison reports additions, removals, and changes

A comparison of two releases MUST report each stable row that appeared, disappeared, or changed. A changed row MUST identify its family and stable identity. The comparison MUST also identify both releases and their source builds.

#### Scenario: A comparison distinguishes row states

- **WHEN** the newer release adds one stable row, removes one stable row, and changes one stable row
- **THEN** the result lists the added row under appeared
- **AND** the result lists the removed row under disappeared
- **AND** the result lists the changed row with its family and stable identity
- **AND** the result names both release builds

#### Scenario: Equal releases have no row changes

- **WHEN** two releases contain equal canonical rows for every family
- **THEN** the result reports no appeared, disappeared, or changed rows
- **AND** it still reports both release identities

### Requirement: The comparison runs against archived releases from the command line

The repository MUST provide a command-line comparison that accepts two archived release references. The command MUST read both archived releases, validate their manifests, and return a non-success result when either reference is unavailable or invalid.

#### Scenario: An operator compares two archived releases

- **WHEN** an operator invokes the comparison command with two archived release references
- **THEN** the command reads both release manifests and canonical data
- **AND** it prints the appeared, disappeared, and changed rows
- **AND** it exits successfully when both releases are valid

#### Scenario: An archived reference is invalid

- **WHEN** an operator invokes the command with a missing or invalid archived release
- **THEN** the command exits unsuccessfully
- **AND** the error names the unavailable or invalid release reference

### Requirement: An extraction pull request publishes its release comparison

A pull request that changes extraction MUST publish the new release digest and a comparison with the selected prior archived release. The pull request text MUST identify the source build and summarize appeared, disappeared, and changed rows.

#### Scenario: Extraction changes are reviewed with a comparison

- **WHEN** CI processes a pull request that changes extraction and has a prior archived release
- **THEN** the pull request body contains the new release digest
- **AND** it contains the comparison summary against that prior release
- **AND** the summary names the source build and all three row-state categories

### Requirement: Archive retrieval preserves a release after pruning

An archived release MUST preserve its manifest, summary digest, raw snapshot, and canonical SQLite artifact together. Retrieval MUST restore those files after the release directory is pruned, so validation and comparison remain possible.

#### Scenario: A pruned release is restored for comparison

- **WHEN** an operator prunes a release directory and retrieves that archived release
- **THEN** retrieval restores the manifest, digest, raw snapshot, and canonical SQLite artifact
- **AND** manifest validation succeeds
- **AND** the comparison command can read the restored release
