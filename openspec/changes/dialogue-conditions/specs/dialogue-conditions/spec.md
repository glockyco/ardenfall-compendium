## Purpose

Defines the authored conditions the compendium publishes from dialogue graphs, so a reader learns what
the game checks before a character speaks, without the compendium evaluating the check or claiming what
a reader can reach.

## ADDED Requirements

### Requirement: A condition is published as an authored declaration

Extraction MUST publish the authored parts of a condition: its kind, its subjects, and the comparison the
game applies. It MUST NOT evaluate the condition, and MUST NOT publish a result.

#### Scenario: A faction check is published

- **WHEN** a dialogue graph holds a faction check naming factions and a comparison
- **THEN** the export contains a condition row naming those factions and that comparison

#### Scenario: A relationship threshold is published

- **WHEN** a dialogue graph holds a relationship check with a tier and a comparison
- **THEN** the export contains a condition row naming that tier and that comparison

### Requirement: A condition's subjects resolve to published entities

A condition subject that names a game asset MUST carry a reference resolving to the entity the compendium
publishes for it, taken from the asset rather than from a display string. A subject that resolves to no
published entity MUST carry a missing reference with a reason and MUST NOT be dropped.

#### Scenario: A faction subject links to its faction page

- **WHEN** a condition names a faction asset that the compendium publishes
- **THEN** the condition's subject references that faction entity

#### Scenario: A subject whose display name differs from its asset name

- **WHEN** a condition names a faction asset whose asset name differs from its published name
- **THEN** the subject resolves through the asset reference
- **AND** the published condition shows the reader-facing name

#### Scenario: An unresolved subject is reported

- **WHEN** a condition names a subject that resolves to no published entity
- **THEN** the condition row is still exported
- **AND** the subject carries a missing reference with a reason

### Requirement: A condition is attributed to the holder that declares it

Every condition MUST name the dialogue holder whose graph declares it. A condition MUST NOT be attributed
to a specific line unless the graph itself carries that link.

#### Scenario: A condition belongs to its holder

- **WHEN** a dialogue graph declares a condition
- **THEN** the condition row names that holder

#### Scenario: A value-plane condition claims no line

- **WHEN** a condition reaches its consumer through a value port rather than a flow connection
- **THEN** the condition row names no line

### Requirement: A relationship tier branch names the tier it selects

Where the graph branches dialogue by relationship tier and a flow connection carries that branch to a
line, the export MUST bind the line to the selected tier using the game's tier vocabulary.

#### Scenario: A tier branch binds a line

- **WHEN** a relationship-tier branch connects directly to a line
- **THEN** the line carries the tier that branch selects

### Requirement: Condition coverage is reported per holder

The run manifest MUST report, per holder kind, how many conditions were read and how many were not bound
to a line. A build that rewires its graphs MUST make that shift visible without a database query.

#### Scenario: An export reports condition coverage

- **WHEN** an export completes
- **THEN** its manifest reports conditions read and conditions unbound per holder kind

### Requirement: Condition wording states the check, not the outcome

Published wording MUST describe what the game checks, using the game's own comparison vocabulary. It MUST
NOT tell a reader that a line is available, unavailable, reachable or required.

#### Scenario: A condition renders as a check

- **WHEN** a page renders a faction condition
- **THEN** the text names the factions and the comparison
- **AND** the text makes no claim about whether the reader satisfies it
