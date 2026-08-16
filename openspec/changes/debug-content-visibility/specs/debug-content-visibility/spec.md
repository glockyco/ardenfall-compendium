## Purpose

Defines release visibility and safe reader labels for content whose game state or runtime binding is not player-facing by default.

## ADDED Requirements

### Requirement: Release policy controls debug-only location visibility

A production release MUST not make a location marked debug-only reachable through a client-side toggle or URL state when the release policy hides it. The policy MUST apply consistently to map points, indexes, search results and direct routes.

#### Scenario: A hidden debug-only location meets a client toggle

- **WHEN** a reader enables every available debug-content control in a production release
- **THEN** a location excluded by the release policy does not appear on the map
- **AND** it does not appear in a production index or search result
- **AND** its direct route does not return a reader page

#### Scenario: An allowed location is shown normally

- **WHEN** a location is not excluded by the production release policy
- **THEN** its allowed map point and page follow the ordinary location visibility rules
- **AND** changing a client control does not create a second publication path

### Requirement: Vestigial skills have an intentional publication status

The compendium MUST give an authored vestigial skill one explicit publication status. If the status is public, every public entry point MUST link to its page. If the status is non-public, no client navigation or direct route MUST expose a reader page.

#### Scenario: A public vestigial skill is retained

- **WHEN** the release policy marks a vestigial skill public
- **THEN** the skill has a reader page
- **AND** the page identifies its vestigial status
- **AND** indexes and relationships use the same route

#### Scenario: A vestigial skill is non-public

- **WHEN** the release policy marks a vestigial skill non-public
- **THEN** its direct route does not return a reader page
- **AND** no index or relationship links to that route

### Requirement: Reader labels contain no unresolved format placeholders

A reader-facing item label MUST contain a resolved runtime argument or a neutral fallback. It MUST NOT expose braces, format tokens or an equivalent unresolved placeholder.

#### Scenario: A recipe label has a resolved binding

- **WHEN** the export contains a stable binding for a recipe label
- **THEN** the item page renders the completed label
- **AND** the label contains no unresolved format token

#### Scenario: A recipe label has no stable binding

- **WHEN** the export cannot resolve the recipe label argument
- **THEN** the item page renders the selected neutral fallback
- **AND** the source label remains available only as provenance
- **AND** the reader does not see the brace form
