## ADDED Requirements

### Requirement: Repeated content states why it repeats

A page MUST NOT print the same content twice without saying why. Topics that are identical in text and
requirement MUST publish as one entry stating how many copies the graph holds, and their continuations
MUST be listed under it. A return link to a point already shown MUST appear once per list.

#### Scenario: A topic the author copied per character

- **WHEN** a graph holds several identical copies of one topic
- **THEN** the page shows one topic and states the number of copies
- **AND** every copy's continuation is listed under it

#### Scenario: Copies that continue to the same place

- **WHEN** several continuations return to the same point already shown
- **THEN** the page states the return once

### Requirement: A choice states when it leads nowhere

An option whose output port the graph leaves unconnected MUST say so. A page MUST NOT show an option
with an empty body.

#### Scenario: An unconnected option

- **WHEN** the graph connects an option's output to nothing
- **THEN** the page states that the conversation stops there

### Requirement: A fork reads as what the game reads

A fork MUST name what it selects on: who the player speaks to, the checks it reads in order, or a
random pick. An output MUST NOT present its port index as a requirement.

#### Scenario: A random pick

- **WHEN** a fork picks one reply at random
- **THEN** the page states that the game picks one at random
- **AND** no alternative reads as a condition

#### Scenario: A fork on who is speaking

- **WHEN** a fork selects on the character the player is speaking to
- **THEN** the page names that character for each alternative
