# dialogue-flow Specification

## Purpose

Defines authored dialogue as published data: what a speaker says, what a player can choose, what
gates each of those, and what a choice causes.

## Requirements

### Requirement: A conversation is the authored graph, not a line list

Each dialogue graph MUST publish its nodes and the authored edges between them. A node MUST carry a
role from the closed set `speech`, `choice`, `branch`, `condition`, `effect`, `jump`, `end`,
`unmodelled`. An edge MUST carry its authored order and, when the source node names its outputs, the
label of the output it leaves from.

A graph carries two planes of connection, and only one of them is the conversation. A flow
connection moves the conversation on. A value connection feeds a node's input, which is where a gate
arrives, so a check MUST attach to the node it gates rather than appear as a step.

The published graph MUST NOT be reduced to a tree. 1,383 nodes in this build have more than one
inbound edge, so a tree would duplicate or drop them.

#### Scenario: A gate arrives on a value input

- **WHEN** a check feeds an opener through a value connection
- **THEN** the gate publishes on that opener
- **AND** the check is not published as a step of the conversation

#### Scenario: A graph is published with its edges

- **WHEN** the extraction reads a dialogue graph
- **THEN** each node it publishes carries a role and the authored node type
- **AND** each edge names its source, its target, its order and its output label
- **AND** a node with several inbound edges keeps every one of them

#### Scenario: An authored node type the model does not hold

- **WHEN** a node type maps to no role
- **THEN** the node publishes with the role `unmodelled` and its authored type name
- **AND** the manifest counts the unmodelled nodes per type
- **AND** the conversation keeps the edges that pass through it

### Requirement: Control nodes are contracted, and jumps are named

A published edge MUST join two nodes a reader cares about. The extraction MUST contract a control
node, which is a node that carries no reader-facing text, no condition and no outcome, by joining its
inbound edges to its outbound edges. Control nodes are 27 percent of this build's dialogue nodes.

A node that returns the conversation to an earlier point MUST publish as a `jump` that names its
target node, and MUST NOT be expanded into a copy of the target.

#### Scenario: A conversation contracts its plumbing

- **WHEN** a speech node reaches a choice through a sequence of control nodes
- **THEN** one published edge joins the speech node to the choice
- **AND** no published node carries the role `control`

#### Scenario: A conversation that returns to its choices

- **WHEN** a reply ends in a node that returns to the last choice
- **THEN** the published graph carries a `jump` node naming the choice it returns to
- **AND** the choice is published once

### Requirement: Speech is an ordered sequence of statements

A speech node MUST publish its statements in authored order, each as a rich-text document through the
shared contract. A node that joins its statements onto one screen MUST record that, because the game
renders it as one block.

#### Scenario: A speech node with continuation screens

- **WHEN** a speech node carries continuation statements, currently 1,092 nodes
- **THEN** every statement publishes with its screen order
- **AND** the node records whether the game shows them as one screen or several

### Requirement: A gate is published as a declaration

A condition MUST publish its subject, its comparison and its compared value as data, and MUST resolve
its subject to a published entity when the game names one. The extraction MUST NOT evaluate a
condition and MUST NOT choose a branch.

A gate MUST attach to the node or the edge it guards, so a reader learns what a choice or an opener
requires.

#### Scenario: A choice behind a faction check

- **WHEN** a choice is guarded by a faction check
- **THEN** the published condition names the factions, the comparison and the guarded choice
- **AND** each faction resolves to its faction page
- **AND** no condition row states whether a player passes it

#### Scenario: A branch with named outputs

- **WHEN** a relationship branch declares its five outputs
- **THEN** each outgoing edge carries the output label it leaves from
- **AND** the branch publishes its subject characters

#### Scenario: A gate the model cannot resolve

- **WHEN** a condition reads runtime state that names no published entity
- **THEN** the condition publishes with its authored node type and no invented subject
- **AND** a diagnostic records the node

### Requirement: An outcome is published as a typed effect

An effect node MUST publish its outcome kind, its amount when it carries one, and a reference to the
entity it acts on. Experience, money, items, item lists, quest state, quest phase, quest objectives,
quest variables, faction relationship, character relationship, teleport destination, combat start and
character death MUST each publish as their own kind.

#### Scenario: A choice that pays and moves the player

- **WHEN** a choice leads to experience, money and a teleport
- **THEN** each outcome publishes with its kind, its amount and its target
- **AND** the teleport target resolves to its location page

#### Scenario: An outcome kind the model does not hold

- **WHEN** an effect node maps to no outcome kind
- **THEN** the node publishes as `unmodelled` with its authored type
- **AND** the manifest counts it

### Requirement: Every authored conversation publishes, holder or not

The published population MUST be the authored dialogue graphs of the build, and a conversation MUST
be identified by its graph asset. A conversation MUST name every holder that reaches it: a character
definition, a character module, a quest character object, a quest character group, a quest scene
object, a scene placement, or the quest the graph itself names. A graph reached from several holders
MUST publish once.

The runtime copies a graph per character that speaks it, and those copies are the same authored
asset, so the population MUST exclude them. The game also attaches many graphs to a character at
runtime, so a graph whose holder the extraction cannot read MUST still publish, and the count of
those MUST reach the export.

#### Scenario: Every holder is opened

- **WHEN** an export completes
- **THEN** the manifest reports the conversations found per holder
- **AND** the report covers character definitions, character modules, the three quest holders and
  scene placements

#### Scenario: A conversation no holder names

- **WHEN** an authored graph names no holder the extraction can read, currently 131 of 219
- **THEN** the conversation still publishes with its script
- **AND** a diagnostic counts them, so the gap is measured rather than hidden

#### Scenario: Runtime copies are not conversations

- **WHEN** a loaded world holds runtime copies of a graph
- **THEN** one conversation publishes for the authored asset
- **AND** no conversation is published per copy

#### Scenario: One graph, several holders

- **WHEN** two holders reach the same dialogue graph
- **THEN** one conversation publishes
- **AND** it names both holders

### Requirement: The published corpus is measured against the build

An export MUST report the conversation count, the node count per role, the statement count, the
authored character count of the published prose, and the unmodelled node count per type.

#### Scenario: Coverage is reported

- **WHEN** an export completes
- **THEN** the manifest carries the counts per role and per holder
- **AND** a fall in published prose between two exports of one build is a failure rather than a
  silent loss

### Requirement: A conversation links to the entities it names

A condition subject and an effect target MUST become a relationship edge from the conversation to the
entity, so an item, a location, a faction, a character or a quest page names the conversations that
reach it.

#### Scenario: An item granted in dialogue

- **WHEN** a choice grants an item
- **THEN** an edge runs from the conversation to that item
- **AND** the item page names the conversation as a source

#### Scenario: A reference that resolves to nothing

- **WHEN** a condition subject or an effect target resolves to no published entity
- **THEN** no edge is invented
- **AND** a diagnostic records the conversation, the node and the reference
