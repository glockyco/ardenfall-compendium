# canonical-data Specification

## Purpose

Defines how extracted fields become canonical SQLite rows, generated read models, and reader-facing values.

## Requirements

### Requirement: Canonical emission flows through typed read models

`pipeline/src/stages/emit-sqlite.ts` MUST emit canonical SQLite before `pipeline/src/stages/emit-read-models.ts` emits read models. `site/src/lib/server/read-models.ts` MUST expose generated read models and site metadata through the server database boundary.

#### Scenario: A release emits site data

- **WHEN** SQLite emission accepts a validated snapshot
- **THEN** the pipeline emits canonical tables, site metadata, and generated read-model tables
- **AND** the site server facade can load the emitted read models from its database

### Requirement: Canonical storage preserves domain shape

`pipeline/src/sql/ddl.ts` and the entity DDL modules MUST use typed domain-shaped tables with root, inheritance, and child tables where the entity requires them. They MUST NOT emit an entity-attribute-value table or a generic type-tag column.

#### Scenario: An item has variant-specific fields

- **WHEN** `pipeline/src/sql/ddl.ts` builds the item schema
- **THEN** it emits the item root and each variant table with typed columns
- **AND** it emits the pipeline-owned `variant` discriminator needed to select the variant
- **AND** it emits no generic attribute-value table

### Requirement: Canonical columns and descriptor fields map exactly

`pipeline/src/stages/emit-sqlite.ts` MUST assert both directions of the canonical table contract. Each stored descriptor field MUST name an existing canonical column, and each canonical column MUST have exactly one declared field, except the pipeline-owned item `variant` discriminator.

#### Scenario: A descriptor column is missing

- **WHEN** a descriptor field names a column absent from its canonical table
- **THEN** `assertCanonicalTableContract` fails the pipeline
- **AND** the error names the entity, field, column, and table

#### Scenario: A table column has no field

- **WHEN** a canonical table column has no declared descriptor field
- **THEN** `assertCanonicalTableContract` fails the pipeline
- **AND** the error names the entity, table, and column

### Requirement: Rich text is translated before site rendering

`pipeline/src/entities/item/read-models.ts`, `pipeline/src/entities/spell/read-models.ts`, and `pipeline/src/entities/status-effect/read-models.ts` MUST translate applicable source strings into rich-text JSON. `site/src/lib/components/content/RichText.svelte` MUST render translated nodes rather than parse source strings.

#### Scenario: A description reaches a detail page

- **WHEN** a read-model emitter receives a game-authored description
- **THEN** it stores the authored source and a translated rich-text document
- **AND** the site server validates the generated document before returning it
- **AND** the rich-text component renders its translated nodes

### Requirement: A runtime substitution publishes as data, not as markup

Rich-text translation MUST publish a token the game substitutes at runtime as a typed node rather
than as literal markup. A conditional token, which `Statement.NameReplace` reads as
`<subject = value ? "a" : "b">`, MUST publish both alternatives and the state that chooses between
them, and a page MUST render both.

A brace token MUST publish as authored text when the build ships no tooltip dictionary, because
`Statement.ApplyModifiers` substitutes no brace and the game renders it as authored. A diagnostic
MUST NOT blame a dictionary the build does not carry.

#### Scenario: A line that differs by the player

- **WHEN** a statement carries a conditional token
- **THEN** the document holds both alternatives, the subject and the comparison
- **AND** the page shows both and names the state that chooses

#### Scenario: A brace in authored prose

- **WHEN** a statement carries a brace token and the build ships no tooltip codes
- **THEN** the text publishes as authored
- **AND** no diagnostic is recorded

### Requirement: Field labels follow game call-site meaning

`pipeline/src/entities/spell/read-models.ts` MUST expose `statTypeRef` as the skill that scales a spell. It MUST emit the `scales_with` relationship rather than label the value as a spell school.

#### Scenario: A spell has a scaling skill

- **WHEN** the read-model emitter resolves a spell stat-type reference
- **THEN** the overview and presentation rows call the value `skill`
- **AND** the graph edge records that the spell scales with that skill
