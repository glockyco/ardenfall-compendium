# evidence-standard Specification

## Purpose

Defines the evidence that a behaviour claim needs. The rules apply to the game and to this repository. Defines the spike that produces evidence, the home of each measurement, and the preflight that keeps an export honest.

## Requirements

### Requirement: A claim about the game needs a measurement

A statement about game behaviour or data shape SHALL become a design input only after a spike answers it with a decompiled-source file and line citation or a probe and its output.

#### Scenario: A design decision rests on game behaviour

- **WHEN** the design of a change states how the game behaves
- **THEN** the statement cites the decompiled source with a file and a line, or a probe and its output
- **AND** a reader can run that probe again from the record

### Requirement: Plausibility is not game evidence

Prior documentation, runtime intuition and plausible readings of field names SHALL NOT count as evidence.

#### Scenario: A plausible plan has no measurement

- WHEN a plan relies on an unmeasured game claim
- THEN documentation and intuition do not establish that claim
- AND a spike is required, as when three plans claimed 683 cells before a spike found 27 loadable cell scenes
- AND a chain-walk rule needs measurement, as when a spike showed a variant re-authoring its parent's name

#### Scenario: A measurement contradicts an earlier document

- **WHEN** a spike contradicts a claim in a plan or a spec
- **THEN** the same change corrects the document and states the measurement
- **AND** the correction replaces the claim and adds no history of the mistake

### Requirement: A claim about this repository needs the same evidence

A statement about repository behaviour SHALL rest on the line that does the work or an observed result. The observation SHALL win when they disagree. Comments, documents, test names, variable names, plans, other agents' reports and the existence of code describe intent rather than what runs.

#### Scenario: A statement rests on a comment or a document

- **WHEN** a change depends on the behaviour of existing code
- **THEN** the design cites the line that produces the behaviour, or an observed result
- **AND** the design does not offer a comment, a test name, or a plan as the evidence

#### Scenario: An artefact contradicts the code

- **WHEN** a comment, a name, or a document disagrees with the code
- **THEN** the commit that finds the disagreement corrects the artefact
- **AND** the correction states the current behaviour and omits the history

#### Scenario: A conclusion depends on the enclosing scope

- **WHEN** a conclusion depends on the object or scope that holds a line
- **THEN** work confirms the scope against the parsed structure or the diff
- **AND** work does not accept an adjacent line as proof of the scope

#### Scenario: An identity-slice hypothesis needs direct evidence

- WHEN a conclusion relies on a one-file window, a query, or an existing mechanism
- THEN work checks the relevant diff, actual field and observed output
- AND this covers the identity-slice failures where a diff contained an omitted phase field, a query used a nonexistent field and its empty result became a defect report, and work extended redirects before observing that they had never written a row

### Requirement: A negative result needs a positive control

A probe that returns nothing does not show absence. The same probe MUST return data for a case that carries the value.

One probe read `variant.nameSets` and returned an empty result for every race. The report named a missing vocabulary. The published field has the name `variant.nameSetRefs`, and every vocabulary was present.

#### Scenario: A probe returns nothing

- **WHEN** a spike returns an empty or zero result that justifies a change
- **THEN** the same probe runs against a case that carries the value
- **AND** the change records both results, or states that no such case exists

### Requirement: An existing mechanism runs before work extends it

Code that exists does not show that the code works. Work SHALL observe the output of a stage, a table, a projection, or an emitter in a built artifact before work extends it.

#### Scenario: Work extends an existing mechanism

- **WHEN** work adds a feature to a stage, a table, or a projection
- **THEN** work first observes the current output in a built artifact
- **AND** work repairs or removes a mechanism that produces nothing, and does not extend it

#### Scenario: A declared output stays empty

- **WHEN** a declared table, layer, or file is empty and its source table holds rows
- **THEN** the pipeline reports that state and does not pass it in silence

### Requirement: Each measurement goes to the producer that owns it

A spike's result SHALL go to one owning producer rather than a separate repository ledger, because a ledger would copy values that already have producers. A spike is a probe answering one question.

#### Scenario: A spike result is recorded

- WHEN a spike answers a question
- THEN its result goes to its owning producer rather than a separate ledger

### Requirement: Build-specific probes stay out of tracked working files

Probes SHALL live in a git-ignored directory because each targets one game build and decays with it.

#### Scenario: A probe is created

- WHEN work creates a build-specific probe
- THEN its working directory is ignored by git

### Requirement: Measurements use emitted artifacts

Counts, availability figures and diagnostic totals SHALL belong to the pipeline-emitted release `artifact-manifest.json` and snapshot `diagnostics.json`.

#### Scenario: A spike measures a count

- **WHEN** a spike measures a count, an availability figure, or a diagnostic total
- **THEN** the change reads that value from the emitted artifact
- **AND** no document restates the value

#### Scenario: A spec claims a number

- **WHEN** a spec states a count from the game
- **THEN** a test asserts that count against the emitted artifact
- **AND** the test fails when the game changes the count

### Requirement: Mechanism evidence stays with its owners

A game mechanism SHALL belong to the spec requirement it justifies in one sentence. A probe and its output SHALL belong to the change that used them and remain in its archive.

#### Scenario: A spike explains a mechanism

- **WHEN** a spike explains how the game behaves
- **THEN** the spec requirement that depends on the mechanism states it in one sentence
- **AND** the archived change keeps the probe and its output

### Requirement: Changed extraction requires a fresh measurement

Work SHALL repeat a measurement after extraction code changes before claiming completion, because the earlier export ran earlier code.

#### Scenario: Extraction code changes after a measurement

- **WHEN** extraction code changes after a measurement
- **THEN** work repeats the measurement before it claims the change complete
- **AND** the reason is that the earlier export ran the earlier code

### Requirement: An export proves which game answered it

An export SHALL name the game build and mod that produced it and fail when more than one instrumented game can answer. Product identity, port ownership and deployed plugin digest SHALL remain independent checks, because two games on one HotRepl port report no error and the connection reaches whichever bound first.

#### Scenario: Two instrumented games run at once

- **WHEN** an export starts and more than one process holds the HotRepl port
- **THEN** the export fails and names the port and the processes
- **AND** the export does not use the instance that answers first

### Requirement: Session exports remain reproducible

Two exports in one loaded session SHALL have matching family counts, filtered runtime-created counts and artifact hashes. Only timing records may differ, and a mismatch SHALL fail the reproducibility check.

#### Scenario: One session produces two exports

- **WHEN** an export runs twice in one session and the world stays loaded
- **THEN** the counts for each family match, the filtered runtime-created count matches, and each artifact hash matches
- **AND** timing records are the only permitted difference
- **AND** a mismatch fails the reproducibility check

### Requirement: Only the main game is a supported source

The current main game, whose Unity product is `Ardenfall Alpha`, SHALL be the only published game. The discontinued Demo SHALL NOT be a fallback. An export SHALL confirm the answering product before writing entity data.

#### Scenario: The answering game is not the published one

- **WHEN** an export connects to the Demo or any product other than `Ardenfall Alpha`
- **THEN** the export fails before extraction
- **AND** the failure states that the main game is required

### Requirement: Snapshots record the answering game

The snapshot SHALL record the answering game's identity.

#### Scenario: A snapshot records its source

- **WHEN** an export produces a snapshot
- **THEN** the snapshot records the identity of the main game that answered
- **AND** that identity can be read from the artifact without the session that produced it

### Requirement: Publication requires main-game identity

Publication SHALL refuse a snapshot whose identity is absent or names a product other than `Ardenfall Alpha`.

#### Scenario: Publication checks the artifact

- **WHEN** publication runs against a snapshot
- **THEN** it proceeds only when the recorded identity names `Ardenfall Alpha`

#### Scenario: A snapshot carries no identity

- **WHEN** publication runs against a snapshot that records no identity
- **THEN** it refuses, because an unproven source is not a proven one

### Requirement: Main-game operations preserve source identity

Probes, exports, snapshot creation and release creation against the current main game SHALL be permitted, with persisted results retaining the main-game identity.

#### Scenario: The alpha is probed

- **WHEN** a probe or export runs against the current main game
- **THEN** the operation is permitted, including snapshot and release creation
- **AND** persisted results retain the main-game identity

### Requirement: Guidance states the supported source

Root repository guidance SHALL state that the main game is the only supported source and point live extraction work to the scoped skill.

#### Scenario: Repository guidance states the publication boundary

- **WHEN** an agent reads the root repository guidance
- **THEN** it states that the main game is the only supported source
- **AND** it points live extraction work to the scoped skill
