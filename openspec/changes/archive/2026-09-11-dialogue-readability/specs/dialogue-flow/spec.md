## ADDED Requirements

### Requirement: A branch output names what it selects

A branch that adds one output per member of a set MUST publish the member each output selects, not the
index its port carries. A branch on a quest's character group MUST resolve the group through the quest
the graph belongs to and publish the character record of each output.

#### Scenario: A branch on the quest's group

- **WHEN** a branch adds one output per character record of a quest character group
- **THEN** each output publishes the character it speaks to
- **AND** the character resolves to its page

#### Scenario: A quest objective check

- **WHEN** a check reads a quest objective
- **THEN** the published condition names the objective, the state it reads and the quest that owns it

### Requirement: An entry point starts something

A published entry MUST have at least one flow edge, or carry a line or an option. A node wired only
into another node's value input MUST NOT publish as an entry, and the count of those MUST reach the
export.

#### Scenario: A check wired into a value input

- **WHEN** a node has no flow edge and carries no line
- **THEN** it publishes no entry point
- **AND** a diagnostic counts it

### Requirement: Contraction preserves every option

Contracting control nodes MUST keep one edge per authored output port. Two options that reach the same
control node MUST both publish an edge.

#### Scenario: Two options through one jump

- **WHEN** several options of one choice enter the same routing node
- **THEN** every option publishes an edge to the node the routing reaches

### Requirement: A wrapped check is read through its wrapper

A check held by a node that wraps a condition task MUST publish as that task. A check MUST NOT publish
under the name of the wrapper that holds it.

#### Scenario: A task behind a wrapper

- **WHEN** a gate is a condition task held by a FlowCanvas wrapper
- **THEN** the published condition carries the task's kind and payload
