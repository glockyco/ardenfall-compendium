## MODIFIED Requirements

### Requirement: An export proves which game answered it

An export SHALL name the build and the mod that produced it. An export SHALL fail when more than one instrumented game can answer.

An export SHALL confirm that the answering game matches the selected supported source profile. The snapshot SHALL record that identity, and publication SHALL refuse a snapshot whose identity is absent, unsupported, or inconsistent with the requested release profile.

The Demo and Alpha are separate supported source profiles. Their snapshots, extractor builds, release artifacts, and site staging slots SHALL remain distinguishable. Measurements and published content SHALL identify which profile produced them.

Two instrumented games on one HotRepl port report no error. The connection reaches the game that bound first. During the identity slice a stale instance answered an export. The snapshot then lacked fields that the deployed mod emits, and the absence looked like a data defect.

#### Scenario: Two instrumented games run at once

- **WHEN** an export starts and more than one process holds the selected profile's HotRepl port
- **THEN** the export fails and names the port and the processes
- **AND** the export does not use the instance that answers first

#### Scenario: One session produces two exports

- **WHEN** an export runs twice in one session and the world stays loaded
- **THEN** the counts for each family match, the filtered runtime-created count matches, and each artifact hash matches
- **AND** timing records are the only permitted difference
- **AND** a mismatch fails the reproducibility check

#### Scenario: The answering game is not the published one

- **WHEN** an export connects to a supported or unsupported install other than the selected profile
- **THEN** the export fails before extraction
- **AND** the failure names the selected profile and answering product

#### Scenario: A snapshot records its source

- **WHEN** an export produces a snapshot
- **THEN** the snapshot records the source profile and identity of the game that answered
- **AND** that identity can be read from the artifact without the session that produced it

#### Scenario: Publication checks the artifact

- **WHEN** publication runs against a snapshot
- **THEN** it proceeds only when the recorded identity names a supported profile
- **AND** that profile matches the requested release profile

#### Scenario: A snapshot carries no identity

- **WHEN** publication runs against a snapshot that records no identity
- **THEN** it refuses, because an unproven source is not a proven one

#### Scenario: The alpha is probed

- **WHEN** a probe or export runs with the Alpha profile selected and the answering game and extractor match it
- **THEN** the operation is permitted, including creation of an Alpha snapshot and release artifact
- **AND** every persisted result remains identified as Alpha content

#### Scenario: Repository guidance states the publication boundary

- **WHEN** an agent reads the root repository guidance
- **THEN** it states that Demo and Alpha are supported, distinct source profiles
- **AND** it points live extraction work to the scoped skill
