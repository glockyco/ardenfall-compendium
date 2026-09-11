# world-dialogue Specification

## Purpose

Defines scene dialogue, the half of the game's authored dialogue that does not hang off a quest.

## Requirements

### Requirement: Scene dialogue is extracted with the graph that holds it

Authored dialogue a scene places MUST become a canonical row per dialogue graph, carrying the graph's asset name, the authored flow the `dialogue-flow` capability defines, and every placement that can start it.

A placement is not the identity. A `SimpleDialogInteractable` carries no `GuidComponent` in 8 of the 27 placements this build ships, including both signs in `cell_interior_4.-2` whose graph holds greetings and topics, so a placement-keyed row cannot publish them at all. The graph asset has a stable name, and the same graph placed twice is one conversation rather than two.

A scene placement is one holder among several. The same graph reached from a character definition or a quest MUST publish once, with both holders named.

#### Scenario: Scene dialogue is extracted

- **WHEN** the walk harvests scene dialogue
- **THEN** each dialogue graph becomes one canonical row identified by its asset name
- **AND** its nodes, edges, statements, gates and outcomes publish through the flow contract
- **AND** every placement that starts it appears as a marker on its map layer

#### Scenario: One graph placed several times

- **WHEN** two placements reference the same dialogue graph
- **THEN** one row carries both placements
- **AND** the page lists each place the reader can start it

#### Scenario: A placement carrying no identity still publishes its dialogue

- **WHEN** a placement carries no `GuidComponent`
- **THEN** its graph's dialogue is still published, because the graph owns the identity
- **AND** the placement is named by its cell and its authored speaker name

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
