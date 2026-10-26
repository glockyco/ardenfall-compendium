# world-dialogue Specification

## Purpose

Defines scene dialogue, the half of the game's authored dialogue that does not hang off a quest.

## Requirements

### Requirement: Scene dialogue is extracted with the graph that holds it

Authored scene dialogue SHALL become a canonical row per graph carrying its asset name, the authored `dialogue-flow` flow and every placement that can start it. Graph asset and owning quest SHALL jointly identify the conversation, not placement or asset name alone.

#### Scenario: Scene dialogue is extracted

- **WHEN** the walk harvests scene dialogue
- **THEN** each dialogue graph becomes one canonical row identified by its asset name and its owning quest
- **AND** its nodes, edges, statements, gates and outcomes publish through the flow contract
- **AND** every placement that starts it appears as a marker on its map layer

### Requirement: Repeated scene graphs publish once

The same graph placed twice SHALL be one conversation carrying both placements.

#### Scenario: One graph placed several times

- **WHEN** two placements reference the same dialogue graph
- **THEN** one row carries both placements
- **AND** the page lists each place the reader can start it

### Requirement: Placements need no identity to publish dialogue

A placement lacking `GuidComponent` SHALL still publish its graph's dialogue, because the graph owns the identity.

#### Scenario: A placement carrying no identity still publishes its dialogue

- **WHEN** a placement carries no `GuidComponent`
- **THEN** its graph's dialogue is still published, because the graph owns the identity
- **AND** the placement is named by its cell and its authored speaker name

#### Scenario: Scene placements lack guid components

- WHEN the build's 27 placements include eight without `GuidComponent`
- THEN both signs in `cell_interior_4.-2` still publish their graph's greetings and topics

### Requirement: Shared scene and non-scene holders publish once

A graph reached from a scene placement and a character definition or quest SHALL publish once with both holders named, because a scene placement is one holder among several.

#### Scenario: A graph has scene and quest holders

- WHEN the same graph is reached from a scene placement and a quest
- THEN one conversation names both holders
- AND graph identity includes the owning quest because 231 authored graphs ship under 211 names and quests reuse generic names

### Requirement: Scene dialogue preserves speaker and flow data

Scene dialogue SHALL publish authored speaker names and authored flow without inventing names or simulating branches.

#### Scenario: A named speaker owns its lines

- **WHEN** a placement carries an authored `dialogName`
- **THEN** the page names that speaker among the places the dialogue starts
- **AND** the page renders its statements through the shared rich-text contract

#### Scenario: Dialogue with no authored speaker name

- **WHEN** a placement has no authored name
- **THEN** the page states that the game gives the speaker no name and identifies the placement by its cell
- **AND** a diagnostic records the placement

#### Scenario: An interactable that holds no dialogue

- **WHEN** a `SimpleDialogInteractable` references no graph, currently 14 of 27 placements
- **THEN** no dialogue row is published for it, because it carries no authored line
- **AND** a diagnostic counts it, so the absence is measured rather than silent

#### Scenario: Authored branches are preserved, not simulated

- **WHEN** dialogue carries conditions or branches
- **THEN** the extraction publishes the authored structure, including the edges and the gates
- **AND** it does not evaluate conditions or choose a branch
