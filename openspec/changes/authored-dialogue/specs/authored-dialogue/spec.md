## Purpose

Defines the authored dialogue corpus the compendium publishes, the holders it is read from, and how each
line is attributed, so a reader sees what a character says rather than the subset one holder happened to
carry.

## ADDED Requirements

### Requirement: Every authored dialogue holder is read

Extraction MUST read authored dialogue from every holder the build carries: character graphs, and the
character, group and scene quest objects. A holder that yields no line MUST be distinguishable from a
holder that was never read.

#### Scenario: A character graph carries dialogue

- **WHEN** a character's graphs include a dialogue graph containing an authored line
- **THEN** the export contains that line

#### Scenario: A group or scene quest object carries dialogue

- **WHEN** a group or scene quest object holds a dialogue graph containing an authored line
- **THEN** the export contains that line

#### Scenario: A holder that yields nothing is reported, not hidden

- **WHEN** a dialogue holder is read and yields no authored line
- **THEN** the export reports that holder as read with a line count of zero

### Requirement: A line carries the text as authored

A published line MUST be the authored text as written in the asset, before any runtime substitution,
debug prefix or failed-check alternative. Extraction MUST NOT call an accessor that rewrites the text.

#### Scenario: A line with a runtime substitution token

- **WHEN** an authored line contains a substitution token
- **THEN** the published line contains that token as authored

### Requirement: A line is attributed to its holder and its speaker

Every line MUST name the entity whose graph carried it and the node kind that carried it. When the node
names a speaker, the line MUST carry a reference to that speaker; when it does not, the line MUST carry
no speaker rather than a guess.

#### Scenario: A line from a character's own graph

- **WHEN** a line comes from a character's dialogue graph
- **THEN** the line names that character as its holder

#### Scenario: A line whose node names no speaker

- **WHEN** an authored line's node names no speaker
- **THEN** the line carries no speaker reference
- **AND** the line is still published

### Requirement: A reused line keeps one row per holder

When one authored line is reached through several holders, the export MUST keep one row per holder so
provenance survives. Presentation MAY collapse repeated text, and MUST NOT drop the holder attribution
that distinguishes the rows.

#### Scenario: One line reached from two holders

- **WHEN** the same authored line is carried by two holders
- **THEN** the export contains one row for each holder

### Requirement: Coverage is reported per holder in every export

The run manifest MUST report, per holder kind, how many graphs were walked and how many lines they
yielded. A build that moves dialogue between holders MUST make that visible without a database query.

#### Scenario: An export reports dialogue coverage

- **WHEN** an export completes
- **THEN** its manifest reports the graphs walked and the lines yielded for each holder kind

### Requirement: A line's holder is resolvable to a published surface

Every line MUST name a holder that presentation can resolve to an entity, so no line depends on a page
that does not exist. A line whose holder resolves to no published entity MUST be counted and reported
rather than published without a home.

#### Scenario: A line whose holder has no page

- **WHEN** an authored line's holder resolves to no published entity
- **THEN** the export counts and reports that line
- **AND** no surface renders it
