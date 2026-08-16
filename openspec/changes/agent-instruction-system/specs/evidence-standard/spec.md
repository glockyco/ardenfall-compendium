## Purpose

Defines what counts as evidence for a claim about behaviour, whether the behaviour belongs to the game or to this repository, how a spike produces that evidence, where the measurement is kept, and the preflight that stops an export from answering with stale code.

## ADDED Requirements

### Requirement: A claim about the game needs a measurement

A statement about game behaviour or data shape is not a design input until a spike answers it. The evidence is a citation of decompiled source, giving file and line, or a probe with its output.

Prior documentation, runtime intuition and a plausible reading of a field name are not evidence. Three plan documents carried "683 cells" until a spike found 27 loadable cell scenes, and a design rule derived from a chain walk was wrong until a spike showed that a variant re-authors the name its parent authored.

#### Scenario: A design decision rests on game behaviour

- **WHEN** a change's design states how the game behaves
- **THEN** the statement cites decompiled source with file and line, or a probe and its recorded output
- **AND** a reader can re-run the probe from what the document records

#### Scenario: An earlier document disagrees with a measurement

- **WHEN** a spike contradicts a claim in an existing plan or spec
- **THEN** the document is corrected in the same change, stating what was measured
- **AND** the correction replaces the claim rather than annotating its history

### Requirement: A claim about this repository needs the same evidence as a claim about the game

An artefact that describes behaviour is a hypothesis, not evidence. A comment, a document, a test name, a variable name, a plan, a prior agent's report, and code that merely exists all describe intent; none of them establishes what runs.

A statement about how this repository behaves is established by reading the line that does the work, or by observing the result. Where the two disagree, the observation wins and the artefact is corrected.

Three failures in the identity slice came from skipping this. A window of a file showed an entry without a phase field, and a design decision was built on that reading until the diff showed the field was there. A query read a field name that did not exist and its empty result was reported as a missing-vocabulary defect. A redirect mechanism was extended, wired and tested before anyone noticed it had never written a row, because its emitter filtered a source type nothing produced.

#### Scenario: A statement rests on a comment or a document

- **WHEN** a change relies on how existing code behaves
- **THEN** the design cites the line that produces the behaviour, or an observed result
- **AND** a comment, a test name or a plan is not offered as the evidence

#### Scenario: An artefact contradicts the code

- **WHEN** a comment, name or document disagrees with what the code does
- **THEN** the artefact is corrected in the same commit as the work that found it
- **AND** the correction states the current behaviour rather than the history of the mistake

#### Scenario: A fragment is not the structure

- **WHEN** a conclusion depends on which object or scope a line belongs to
- **THEN** it is confirmed against the authoritative form, such as the parsed structure or the diff
- **AND** an adjacent line is not taken as proof of the enclosing scope

### Requirement: An existing mechanism is proved to run before it is extended

Code that exists is not evidence that it works. Before a stage, table, projection or emitter is extended, its output is observed in a built artifact.

#### Scenario: A mechanism is about to gain a feature

- **WHEN** work would extend an existing stage, table or projection
- **THEN** its current output is observed in a built artifact first
- **AND** a mechanism found to produce nothing is repaired or removed rather than extended

#### Scenario: A declared output is empty

- **WHEN** a declared table, layer or file is empty while its source carries rows
- **THEN** that state is reported by the pipeline rather than passing silently

### Requirement: A negative result needs a positive control

A probe that returns nothing is not evidence of absence until the same probe returns data for a case known to carry it.

This is not a formality. A probe reading `variant.nameSets` returned empty for every race and was reported as a missing-vocabulary defect; the published field is `variant.nameSetRefs`, and the vocabulary was there all along.

#### Scenario: A probe finds nothing

- **WHEN** a spike reports an empty or zero result that would justify a change
- **THEN** the same probe is run against a case known to carry the value
- **AND** the change records both results, or states that no such case exists

### Requirement: Spikes are disposable and their measurements are not

A spike is a throwaway probe answering one question. Probes live in a gitignored directory, because they are written against one game build and rot with it. The measurement they produce is durable and is recorded in the evidence ledger under `docs/plans/` with its date and the game build it came from.

#### Scenario: A spike answers a question

- **WHEN** a spike produces a number, a shape or a mechanism that a change depends on
- **THEN** the measurement, its date and the game build are recorded in the ledger
- **AND** the probe itself is not committed

#### Scenario: The mod changes after a measurement

- **WHEN** extraction code changes after a measurement was taken
- **THEN** the measurement is retaken before the change is claimed complete, because the previous export cannot have exercised the new code

### Requirement: An export proves which game answered it

An export states which build and which mod produced it, and refuses to run when more than one instrumented game could answer.

Two instrumented games sharing the HotRepl port do not report an error; connections reach whichever bound first. During the identity slice an export was answered by a stale instance, and the snapshot lacked fields the deployed mod emits, which read as a data defect rather than as a targeting mistake.

#### Scenario: Two instrumented games are running

- **WHEN** an export starts and more than one process holds the HotRepl port
- **THEN** the export fails naming the port and the processes
- **AND** it does not fall back to whichever instance answers first

#### Scenario: One session produces two exports

- **WHEN** an export runs twice against one session without reloading the world
- **THEN** the per-family counts, the filtered runtime-created count and every artifact hash match, except timing records
- **AND** a mismatch fails the reproducibility check rather than being reported as a difference in the game
