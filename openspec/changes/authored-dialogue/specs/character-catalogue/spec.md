## MODIFIED Requirements

### Requirement: Dialogue is presented by the character who speaks it

Authored dialogue MUST render on the page of the character who speaks it, and on the quest that owns the
dialogue graph when a quest owns it. A line held by a character's own graph has no owning quest, and MUST
still render on that character's page. No dialogue may depend on a page that does not exist.

#### Scenario: A quest character keeps dialogue on both surfaces

- **WHEN** a quest character carries a dialogue graph, including one with no authored name
- **THEN** the character page renders the dialogue
- **AND** the quest page lists the character and its lines

#### Scenario: A character graph line renders without a quest

- **WHEN** a line is held by a character's own dialogue graph and no quest owns that graph
- **THEN** the character page renders the line
- **AND** no quest surface is required for it
