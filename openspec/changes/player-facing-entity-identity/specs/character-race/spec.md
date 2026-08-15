## Purpose

Defines race as a published entity, because it is the authored vocabulary the game uses to name characters it does not name individually, and it is the classification a reader recognises.

## ADDED Requirements

### Requirement: Race is extracted as an entity with its naming vocabulary

The compendium MUST extract `CharacterRace` as an entity, including its player-visible name and the name sets it uses to generate character names. A race MUST record how many name sets it carries and in what order they combine.

#### Scenario: A named race is published

- **WHEN** a race carries a player-visible name, as `Karu Elf`, `Obsidian Dwarf` and `Sand Elf` do
- **THEN** the race has a canonical row and a public page
- **AND** the page names the race and lists the character definitions that use it

#### Scenario: A creature race without its own name

- **WHEN** a race carries no player-visible name, as the per-creature races such as `race_balati` do
- **THEN** the race is still extracted
- **AND** its identity in presentation comes from the character definitions that use it rather than from its asset name

#### Scenario: Name sets are published as vocabulary

- **WHEN** a race carries name sets
- **THEN** the race row records the count and combination order of those sets
- **AND** the page explains that a character of this race without an authored name receives one built from them

### Requirement: Every character states its race

A character definition and a placement MUST both link to the race that supplies their appearance and their generated name. A character whose race is missing MUST record a diagnostic rather than present an empty field.

#### Scenario: A character links to its race

- **WHEN** a character definition resolves a race
- **THEN** the character page names the race and links to it
- **AND** the race page lists that character among its own

#### Scenario: A character without a race

- **WHEN** a character resolves no race, which one definition in the current build does
- **THEN** a diagnostic names the character and the field
- **AND** the page states that the game defines no race for it

### Requirement: A generated name is explained through its race

Where a character's name is generated, presentation MUST attribute it to the race's name sets and MUST NOT display a sample name.

#### Scenario: A page explains a generated name

- **WHEN** a reader opens a character whose name the game generates
- **THEN** the page says the game builds the name from the race's name sets when the player meets the character
- **AND** the page links to the race
- **AND** no invented or sampled name appears anywhere on the page
