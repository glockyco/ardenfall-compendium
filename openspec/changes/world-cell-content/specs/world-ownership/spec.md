## Purpose

Defines how authored ownership of a placed object reaches the reader, so a page can say whose property something is.

## ADDED Requirements

### Requirement: Ownership is extracted from the authored owner

A placed object carrying an `OwnedObject` MUST export its faction owners and its character owners. A character owner is a record reference and MUST resolve to a published placed character.

#### Scenario: A container owned by a character

- **WHEN** a container declares a character owner
- **THEN** an ownership edge runs from the container to that character
- **AND** the character page lists what they own
- **AND** the container page names the owner

#### Scenario: A container owned by a faction

- **WHEN** a container declares a faction owner
- **THEN** an ownership edge runs from the container to that faction
- **AND** the faction page lists what it owns

#### Scenario: A placed item can be owned

- **WHEN** a placed item declares an owner
- **THEN** the same ownership edges apply to it
- **AND** the item's page can distinguish an owned copy from an unowned one

#### Scenario: An unresolvable owner is reported

- **WHEN** an owner reference does not resolve to a published entity
- **THEN** the row records a diagnostic naming the object and the reference
- **AND** no edge is invented

### Requirement: Ownership is stated as authorship, not as consequence

Presentation MUST describe the authored ownership and MUST NOT assert what happens when a player takes the object, since that depends on witnesses, relationships and faction state at runtime.

#### Scenario: Wording stays within the data

- **WHEN** a page shows that an object is owned
- **THEN** it says who the game records as the owner
- **AND** it does not claim that taking the object is or is not a crime
