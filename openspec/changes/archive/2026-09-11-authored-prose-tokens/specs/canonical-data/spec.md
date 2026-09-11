## ADDED Requirements

### Requirement: A runtime substitution publishes as data, not as markup

Rich-text translation MUST publish a token the game substitutes at runtime as a typed node rather
than as literal markup. A conditional token MUST publish both alternatives and the state that chooses
between them, and a page MUST render both. A brace token MUST publish as authored text when the build
ships no tooltip dictionary, and a diagnostic MUST NOT blame a dictionary the build does not carry.

#### Scenario: A line that differs by the player

- **WHEN** a statement carries a conditional token
- **THEN** the document holds both alternatives, the subject and the comparison
- **AND** the page shows both and names the state that chooses

#### Scenario: A brace in authored prose

- **WHEN** a statement carries a brace token and the build ships no tooltip codes
- **THEN** the text publishes as authored
- **AND** no diagnostic is recorded
