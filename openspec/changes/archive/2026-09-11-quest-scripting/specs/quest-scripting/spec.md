## Purpose

Defines the authored quest triggers and effects the compendium reads from quest logic graphs, so a
reader learns what the game declares makes a quest advance without the compendium claiming what a
player can reach.

## ADDED Requirements

### Requirement: Every quest logic graph is walked and accounted for

Extraction MUST walk each quest's logic graph and MUST count every node it meets by node type. The
export MUST report those counts. A quest that holds a graph MUST be distinguishable from a quest that
holds none.

#### Scenario: A quest with a logic graph reports its node census

- **WHEN** a quest holds a logic graph containing nodes
- **THEN** the export reports that quest's node count by node type

#### Scenario: A quest without a logic graph is not a failure

- **WHEN** a quest holds no logic graph
- **THEN** extraction succeeds for that quest
- **AND** the export distinguishes it from a quest whose graph yielded no recognised node

### Requirement: An unrecognised node type is reported, never dropped in silence

When the walk meets a node type it does not model, extraction MUST emit a diagnostic naming that type
and MUST continue. It MUST NOT omit the type from the census.

#### Scenario: A build introduces a node type the walk does not model

- **WHEN** a quest logic graph contains a node type extraction does not model
- **THEN** a diagnostic names that node type
- **AND** the census counts it

### Requirement: A trigger names its subject through a resolved reference

A location-entry trigger MUST carry a reference to the location entity it names, and an
item-acquisition trigger MUST carry references to the item entities its filter names. When a reference
cannot be resolved, the row MUST carry a missing reference with a reason and MUST NOT be dropped.

#### Scenario: A location-entry trigger resolves to its location

- **WHEN** a quest logic graph declares a trigger that fires on entering a location
- **THEN** the trigger row references that location entity

#### Scenario: An unresolved trigger subject is reported

- **WHEN** a trigger names a subject that extraction cannot resolve to an entity
- **THEN** the trigger row is still exported
- **AND** it carries a missing reference with a reason

### Requirement: Granted achievements are published as authored ids

A node that grants an achievement MUST export the authored achievement id as text. The compendium MUST
NOT invent a display name for it.

#### Scenario: A quest grants an achievement

- **WHEN** a quest logic graph grants an achievement
- **THEN** the quest's published data includes that authored achievement id

### Requirement: Quest and objective effects name the state they set

An effect that sets a quest state or an objective state MUST name the quest or objective it targets and
the state it sets.

#### Scenario: An objective effect names its objective and state

- **WHEN** a quest logic graph sets an objective's state
- **THEN** the effect row names that objective and the state it sets

### Requirement: A trigger is an authored fact, not a reachability claim

Published wording for a trigger MUST describe what the game declares. It MUST NOT state that a reader
can reach, cannot reach, or must reach anything, and it MUST NOT present a trigger as a completion
requirement.

#### Scenario: A trigger renders as an authored declaration

- **WHEN** a quest page renders a location-entry trigger
- **THEN** the text describes the authored trigger
- **AND** the text makes no claim about whether a player can reach that location

### Requirement: Relationship edges exist only between published entities

A trigger MUST produce a relationship edge only when both ends are published entities, and every
predicate it uses MUST hold a registry entry. A trigger whose subject is not an entity MUST remain a
row without an edge.

#### Scenario: A location trigger produces a registered edge

- **WHEN** a quest declares a location-entry trigger for a published location
- **THEN** the graph holds an edge from that quest to that location under a registered predicate

#### Scenario: An achievement grant produces no edge

- **WHEN** a quest grants an achievement id
- **THEN** no relationship edge is created for it
- **AND** the achievement id remains readable on the quest
