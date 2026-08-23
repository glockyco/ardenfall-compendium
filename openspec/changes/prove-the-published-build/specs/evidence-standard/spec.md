## MODIFIED Requirements

### Requirement: An export proves which game answered it

An export SHALL name the build and the mod that produced it. An export SHALL fail when more than one instrumented game can answer.

An export SHALL confirm the identity of the answering game and SHALL fail when it is not the published game. The snapshot SHALL record that identity, and publication SHALL refuse a snapshot whose recorded identity is absent or names another game.

Steam holds two installs and they are different games. Only the Demo is public. The full game is a private alpha, and no content extracted from it may reach a reader. Measuring the alpha is legitimate, so the boundary is enforced where content becomes published rather than where the game is connected.

Two instrumented games on one HotRepl port report no error. The connection reaches the game that bound first. During the identity slice a stale instance answered an export. The snapshot then lacked fields that the deployed mod emits, and the absence looked like a data defect.

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

- **WHEN** an export runs against an install other than the published game
- **THEN** the export fails
- **AND** the failure states that content from that install must not be published

#### Scenario: A snapshot records its source

- **WHEN** an export produces a snapshot
- **THEN** the snapshot records the identity of the game that answered
- **AND** that identity can be read from the artifact without the session that produced it

#### Scenario: Publication checks the artifact

- **WHEN** publication runs against a snapshot
- **THEN** it proceeds only when the recorded identity names the published game

#### Scenario: A snapshot carries no identity

- **WHEN** publication runs against a snapshot that records no identity
- **THEN** it refuses, because an unproven source is not a proven one

#### Scenario: The alpha is measured

- **WHEN** a measurement is taken against the private alpha
- **THEN** it is permitted
- **AND** its results stay outside published content
