## Purpose

Defines pipeline-owned facets and generated filter read models for entity-family pages and map filtering.

## ADDED Requirements

### Requirement: Faceted families receive generated filter read models

The pipeline MUST generate a filter read model for each entity family whose descriptor declares facets. The model MUST extend the existing `item_overview_filters` table for item overviews. It MUST preserve and extend the descriptor-owned `map_layers.filters_json` metadata for map filters.

#### Scenario: A descriptor declares a categorical facet

- **WHEN** pipeline emission processes a family with a categorical facet declaration
- **THEN** its generated filter read model contains that facet and its available options
- **AND** the options carry generated values and reader-facing labels

#### Scenario: A family has no facet declaration

- **WHEN** pipeline emission processes a family without facet declarations
- **THEN** it emits no facet options for that family
- **AND** it does not invent a route-specific filter list

### Requirement: Facet options come from emitted data

A facet value MUST come from rows emitted for the selected entity family. A site route MUST NOT define a hand-written list of facet values or labels.

#### Scenario: Emitted data adds a facet value

- **WHEN** emitted rows contain a value declared by a family facet
- **THEN** the generated filter read model exposes that value and its generated label
- **AND** the page can offer the value without a route change

#### Scenario: Emitted data removes a facet value

- **WHEN** no emitted row contains a previously available facet value
- **THEN** the generated filter read model omits that value
- **AND** the page does not offer the stale value

### Requirement: A filtered page states the applied facet

A page MUST expose the selected facet and its value in reader-facing content when a facet narrows its rows. The statement MUST use the generated label.

#### Scenario: A reader applies a facet

- **WHEN** a reader selects a facet value
- **THEN** the page states which facet and value it applied
- **AND** the result set reflects that selection

#### Scenario: A reader clears a facet

- **WHEN** a reader clears the selected facet
- **THEN** the page removes the applied-facet statement
- **AND** the unfiltered result set is available again

### Requirement: A facet with no matching rows remains an empty result

A selected facet MUST render the page's empty-result state when no emitted row matches. The page MUST remain present. It MUST NOT hide the facet or substitute unrelated rows.

#### Scenario: A valid facet has no matches

- **WHEN** a reader selects a generated facet value with no matching rows
- **THEN** the page renders an empty result state
- **AND** it keeps the selected facet visible
- **AND** it does not render unrelated rows
