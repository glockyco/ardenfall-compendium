## Purpose

Defines the evidence that a behaviour claim needs. The rules apply to the game and to this repository. Defines the spike that produces evidence, the home of each measurement, and the preflight that keeps an export honest.

## ADDED Requirements

### Requirement: A claim about the game needs a measurement

A statement about game behaviour or game data shape becomes a design input only after a spike answers it. The evidence is a citation of the decompiled source with a file and a line, or a probe with its output.

Prior documentation is not evidence. Runtime intuition is not evidence. A plausible reading of a field name is not evidence. Three plan documents claimed 683 cells until a spike found 27 loadable cell scenes. A chain-walk rule looked correct until a spike showed that a variant re-authors the name of its parent.

#### Scenario: A design decision rests on game behaviour

- **WHEN** the design of a change states how the game behaves
- **THEN** the statement cites the decompiled source with a file and a line, or a probe and its output
- **AND** a reader can run that probe again from the record

#### Scenario: A measurement contradicts an earlier document

- **WHEN** a spike contradicts a claim in a plan or a spec
- **THEN** the same change corrects the document and states the measurement
- **AND** the correction replaces the claim and adds no history of the mistake

### Requirement: A claim about this repository needs the same evidence

An artefact that describes behaviour is a hypothesis. A comment, a document, a test name, a variable name, a plan, a report from another agent, and code that exists all describe intent. None of them shows what runs.

A statement about the behaviour of this repository rests on the line that does the work, or on an observed result. The observation wins when the two disagree.

Three failures in the identity slice show the cost. A window of one file showed an entry without a phase field, and the diff showed the field. A query read a field name that does not exist, and its empty result became a defect report. Work extended the redirect mechanism before anyone saw that the mechanism had never written a row.

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

### Requirement: A negative result needs a positive control

A probe that returns nothing does not show absence. The same probe MUST return data for a case that carries the value.

One probe read `variant.nameSets` and returned an empty result for every race. The report named a missing vocabulary. The published field has the name `variant.nameSetRefs`, and every vocabulary was present.

#### Scenario: A probe returns nothing

- **WHEN** a spike returns an empty or zero result that justifies a change
- **THEN** the same probe runs against a case that carries the value
- **AND** the change records both results, or states that no such case exists

### Requirement: An existing mechanism runs before work extends it

Code that exists does not show that the code works. Work observes the output of a stage, a table, a projection, or an emitter in a built artifact before work extends it.

#### Scenario: Work extends an existing mechanism

- **WHEN** work adds a feature to a stage, a table, or a projection
- **THEN** work first observes the current output in a built artifact
- **AND** work repairs or removes a mechanism that produces nothing, and does not extend it

#### Scenario: A declared output stays empty

- **WHEN** a declared table, layer, or file is empty and its source table holds rows
- **THEN** the pipeline reports that state and does not pass it in silence

### Requirement: Each measurement goes to the producer that owns it

A spike is a probe that answers one question. Probes live in a directory that git ignores, because each probe targets one game build and decays with it. The result then goes to one owner. The repository holds no separate ledger, because a ledger would copy values that already have producers.

- A count, an availability figure, and a diagnostic total belong to the release `artifact-manifest.json` and the snapshot `diagnostics.json`. The pipeline emits both.
- A game mechanism belongs to the spec requirement that it justifies, in one sentence.
- The probe and its output belong to the change that used them, and stay in the archived change.

#### Scenario: A spike measures a count

- **WHEN** a spike measures a count, an availability figure, or a diagnostic total
- **THEN** the change reads that value from the emitted artifact
- **AND** no document restates the value

#### Scenario: A spec claims a number

- **WHEN** a spec states a count from the game
- **THEN** a test asserts that count against the emitted artifact
- **AND** the test fails when the game changes the count

#### Scenario: A spike explains a mechanism

- **WHEN** a spike explains how the game behaves
- **THEN** the spec requirement that depends on the mechanism states it in one sentence
- **AND** the archived change keeps the probe and its output

#### Scenario: Extraction code changes after a measurement

- **WHEN** extraction code changes after a measurement
- **THEN** work repeats the measurement before it claims the change complete
- **AND** the reason is that the earlier export ran the earlier code

### Requirement: An export proves which game answered it

An export names the build and the mod that produced it. An export fails when more than one instrumented game can answer.

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
