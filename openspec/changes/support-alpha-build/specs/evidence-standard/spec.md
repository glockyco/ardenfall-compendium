## MODIFIED Requirements

### Requirement: An export proves which game answered it

An export SHALL name the game build and mod that produced it. An export SHALL fail when more than one instrumented game can answer.

The current main game, whose Unity product is `Ardenfall`, is the only published game. The discontinued Demo is not a supported fallback. An export SHALL confirm the answering product before it writes entity data. The snapshot SHALL record that identity, and publication SHALL refuse a snapshot whose identity is absent or names another product.

Two instrumented games on one HotRepl port report no error. The connection reaches the game that bound first. Product identity, port ownership, and the deployed plugin digest therefore remain independent required checks.

#### Scenario: Two instrumented games run at once

- **WHEN** an export starts and more than one process holds the HotRepl port
- **THEN** the export fails and names the port and the processes
- **AND** the export does not use the instance that answers first

#### Scenario: One session produces two exports

- **WHEN** an export runs twice in one session and the world stays loaded
- **THEN** the counts for each family match, the filtered runtime-created count matches, and each artifact hash matches
- **AND** timing records are the only permitted difference
- **AND** a mismatch fails the reproducibility check

#### Scenario: The answering game is not the published one

- **WHEN** an export connects to the Demo or any product other than `Ardenfall`
- **THEN** the export fails before extraction
- **AND** the failure states that the main game is required

#### Scenario: A snapshot records its source

- **WHEN** an export produces a snapshot
- **THEN** the snapshot records the identity of the main game that answered
- **AND** that identity can be read from the artifact without the session that produced it

#### Scenario: Publication checks the artifact

- **WHEN** publication runs against a snapshot
- **THEN** it proceeds only when the recorded identity names `Ardenfall`

#### Scenario: A snapshot carries no identity

- **WHEN** publication runs against a snapshot that records no identity
- **THEN** it refuses, because an unproven source is not a proven one

#### Scenario: The alpha is probed

- **WHEN** a probe or export runs against the current main game
- **THEN** the operation is permitted, including snapshot and release creation
- **AND** persisted results retain the main-game identity

#### Scenario: Repository guidance states the publication boundary

- **WHEN** an agent reads the root repository guidance
- **THEN** it states that the main game is the only supported source
- **AND** it points live extraction work to the scoped skill
