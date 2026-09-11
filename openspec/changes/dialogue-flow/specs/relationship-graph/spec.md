## ADDED Requirements

### Requirement: A conversation's gates and outcomes are relationship edges

Every entity a conversation names in a gate or an outcome MUST become a relationship edge from the conversation to that entity, through a declared predicate. An entity page MUST therefore be able to name the conversations that gate on it or act on it.

A predicate MUST separate a gate from an outcome, because the two say different things about the entity: one reads the state, and the other changes it.

#### Scenario: An outcome that grants an item

- **WHEN** a choice grants an item or an item list
- **THEN** an edge runs from the conversation to each item
- **AND** the item page names the conversations that grant it

#### Scenario: A gate that reads faction membership

- **WHEN** an opener or a choice is gated on faction membership
- **THEN** an edge runs from the conversation to each faction
- **AND** the faction page names the conversations gated on it

#### Scenario: An outcome that moves the player

- **WHEN** a choice teleports the character to a location
- **THEN** an edge runs from the conversation to that location
- **AND** the location page names the conversations that lead to it

#### Scenario: A reference that resolves to nothing

- **WHEN** a gate subject or an outcome target resolves to no published entity
- **THEN** no edge is emitted
- **AND** the graph audit reports the conversation, the node and the reference
