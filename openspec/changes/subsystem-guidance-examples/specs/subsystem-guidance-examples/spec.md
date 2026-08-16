## Purpose

Defines the worked examples that keep subsystem guidance aligned with the repository contracts.

## ADDED Requirements

### Requirement: Pipeline and site guidance show a generated read-model cutover pair

The subsystem guides MUST contain one wrong example and one right example for a generated presentation or read-model cutover. The wrong example MUST leave the old public path or duplicate producer in place. The right example MUST remove the old public path and name the current producer. Each example MUST cite a real file in the repository.

#### Scenario: A maintainer checks the read-model cutover example

- **WHEN** a maintainer reads the generated read-model guidance
- **THEN** the guide contains both wrong and right versions of the same cutover
- **AND** the right version shows the old public path removed
- **AND** the pair cites files such as `pipeline/src/entities/registry.ts` and `site/src/lib/server/read-models.ts`

#### Scenario: A guide contains only a sketch

- **WHEN** a read-model example names no file in the repository
- **THEN** the guidance check rejects the example
- **AND** the guide does not satisfy the cutover requirement

### Requirement: Site guidance shows typed rich text instead of raw markup

The site guide MUST contain one wrong example and one right example for rich-text rendering. The wrong example MUST render raw game or markup text. The right example MUST render the typed rich-text document supplied by the read model. Each example MUST cite a real component file.

#### Scenario: A maintainer checks the rich-text example

- **WHEN** a maintainer reads the rich-text guidance
- **THEN** the guide contains a paired wrong and right example
- **AND** the right example uses the shared typed rich-text component contract
- **AND** the pair cites `site/src/lib/components/content/RichText.svelte`

#### Scenario: The right example bypasses the shared contract

- **WHEN** the right rich-text example uses raw markup or a route-local parser
- **THEN** the guidance check rejects the example
- **AND** the guide does not satisfy the typed rich-text requirement

### Requirement: Pipeline and site guidance show relationship-link ownership

The subsystem guides MUST contain one wrong example and one right example for relationship links. The wrong example MUST compose a target label or durable route in a site route. The right example MUST use the relationship data resolved by the pipeline and render the supplied target label, route, and page status. Each example MUST cite a real pipeline or site file.

#### Scenario: A maintainer checks the relationship example

- **WHEN** a maintainer reads the relationship-link guidance
- **THEN** the guide contains paired wrong and right versions
- **AND** the right version gets link text and route data from the relationship read model
- **AND** the pair cites files such as `pipeline/src/relationships/relationship-graph.ts` and `site/src/lib/components/relationships/EntityLink.svelte`

#### Scenario: A route invents relationship text

- **WHEN** the right relationship example builds link text from a source name or route parameter
- **THEN** the guidance check rejects the example
- **AND** the guide does not satisfy the relationship-link requirement

### Requirement: Site guidance shows component intake as a consumed shared component

The site guide MUST contain one wrong example and one right example for taking a new component into the site. The wrong example MUST add repeated route-local markup or an untyped visual shortcut. The right example MUST show a consumed component with typed props, token-backed styling, and accessibility notes. Each example MUST cite a real component and route file.

#### Scenario: A maintainer checks the component-intake example

- **WHEN** a maintainer reads the component-intake guidance
- **THEN** the guide contains paired wrong and right versions
- **AND** the right version shows a component used by a route
- **AND** the pair cites files under `site/src/lib/components/` and `site/src/routes/`

#### Scenario: A component example is not consumed

- **WHEN** the right component example has no route consumer or file citation
- **THEN** the guidance check rejects the example
- **AND** the guide does not satisfy the component-intake requirement
