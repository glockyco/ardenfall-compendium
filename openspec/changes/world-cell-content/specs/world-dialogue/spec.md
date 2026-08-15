## Purpose

Defines scene dialogue owners, the half of the game's authored dialogue that does not hang off a quest.

## ADDED Requirements

### Requirement: A scene dialogue owner is extracted with its name and its lines

Each `SimpleDialogInteractable` MUST become a canonical row carrying its authored `dialogName`, its interaction text, its cell and its position, and its dialogue graphs MUST be extracted through the same read models quest dialogue uses.

#### Scenario: Scene dialogue is extracted

- **WHEN** the walk harvests scene dialogue owners, currently 25 across the authored cells
- **THEN** each becomes a canonical row with its authored name
- **AND** its lines are extracted as greetings and topics like quest dialogue
- **AND** it appears as a marker on its map layer

#### Scenario: A named speaker owns its lines

- **WHEN** a scene dialogue owner carries an authored `dialogName`
- **THEN** that name titles its page
- **AND** the page renders its lines through the shared rich-text contract

#### Scenario: Dialogue with no authored name

- **WHEN** a scene dialogue owner has no authored name
- **THEN** the page states that the game gives the speaker no name and identifies it by its location
- **AND** a diagnostic records the object

#### Scenario: Authored branches are preserved, not simulated

- **WHEN** dialogue lines carry conditions or branches
- **THEN** the extraction preserves the authored structure
- **AND** it does not evaluate conditions or choose a branch
