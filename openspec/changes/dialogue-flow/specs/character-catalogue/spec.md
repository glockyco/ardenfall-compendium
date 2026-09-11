## MODIFIED Requirements

### Requirement: Dialogue is presented by the character who speaks it

Authored dialogue MUST reach the page of the character who speaks it, and the page of the quest that owns the dialogue graph. Each page MUST list the conversations it holds, with the holder that reaches each one, and MUST link to the conversation page. No dialogue may depend on a page that does not exist.

A character page MUST NOT render a second, simpler copy of the dialogue. One conversation contract serves every surface.

#### Scenario: A quest character keeps dialogue on both surfaces

- **WHEN** a quest character carries a dialogue graph, including one with no authored name
- **THEN** the character page lists that conversation
- **AND** the quest page lists the character and the conversation it owns
- **AND** each entry links to the conversation page

#### Scenario: A character that speaks through its definition

- **WHEN** a character definition or a character module holds a dialogue graph
- **THEN** the character page lists that conversation with its holder
- **AND** the conversation publishes once, however many holders reach it
