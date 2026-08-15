## Purpose

Defines how an entity gets the name a reader sees, how that name is distinguished from a designer's identifier, and how the compendium decides whether an entity is a page at all.

## ADDED Requirements

### Requirement: A descriptor declares the provenance of every name it extracts

Each entity descriptor MUST declare its naming sources in a `naming` block. A source MUST carry a `policy` of either `player-visible`, meaning the game shows this string to a player, or `designer-identifier`, meaning a designer typed it for authoring or debugging. A descriptor MUST NOT declare a name source without a policy.

#### Scenario: A placement declares both kinds of name

- **WHEN** the `npc` descriptor declares `displayName` from the embedded character data's `charName` and `authoringLabel` from `customFriendlyID`
- **THEN** validation accepts the descriptor
- **AND** the emitted canonical row carries both values in separate columns

#### Scenario: An authoring identifier cannot title a page

- **WHEN** a read model attempts to use a `designer-identifier` value as an entity node label
- **THEN** the pipeline fails the run with a contract error naming the entity and the field

#### Scenario: A descriptor omits the policy

- **WHEN** a descriptor declares a name source with no `policy`
- **THEN** descriptor validation fails and names the offending entity and field

### Requirement: A display name is a name the game would show

A resolved `player-visible` candidate becomes a display name only when it passes a single shared test. The test MUST reject an empty or whitespace value, a value containing a `{token}` substitution placeholder, and a value beginning with `BASE` or `PLACEHOLDER` in any casing. All entity families MUST use this one test.

#### Scenario: An authored character name passes

- **WHEN** a definition resolves `charName` through the prototype chain to `Darvaki`
- **THEN** the value is a display name
- **AND** the definition is eligible for a public page

#### Scenario: A prototype name fails

- **WHEN** a definition resolves to an empty name, as `base_creature` and the `preset_*` role presets do
- **THEN** the value is not a display name
- **AND** the entity records that it has no display name

#### Scenario: A template name fails

- **WHEN** an item composes the name `Scroll of {lvl} {name}`
- **THEN** the value is not a display name
- **AND** the item keeps the same treatment it has today

### Requirement: A public page requires a display name

An entity MUST have a public page only when it resolves a display name. An entity without one MUST keep its canonical row, its placement, its map marker and its relationship edges, and MUST be presented by the page that owns it, such as its type, its location or its quest.

#### Scenario: A nameless definition is data without a page

- **WHEN** the pipeline emits the 59 definitions that resolve no display name
- **THEN** no `entity_nodes` row for them has `has_page = 1`
- **AND** no sitemap entry, prerendered page or search index entry exists for them
- **AND** their rows remain in the canonical table

#### Scenario: A nameless placement stays on the map

- **WHEN** a placement resolves no display name of its own
- **THEN** it has no page
- **AND** its map point still renders on its layer
- **AND** the page that owns it lists it

#### Scenario: An entity with no display name is never an edge target

- **WHEN** a relationship would point at an entity without a display name
- **THEN** the edge is suppressed
- **AND** the source row records a diagnostic naming the predicate and the unpublishable target

### Requirement: Absence of a name is reported, never invented

When an entity resolves no display name, extraction MUST emit a diagnostic naming the entity and the field, and the canonical column MUST be null. Presentation MUST state the absence rather than substitute an identifier, a row id, or a generated value.

#### Scenario: A placement without any authored name

- **WHEN** a placement resolves neither an own name nor an inherited one
- **THEN** the canonical display-name column is null
- **AND** a diagnostic records the placement and the field
- **AND** any surface that must label it says so in words rather than showing its record id

### Requirement: Authoring labels remain available as provenance

A `designer-identifier` value MUST remain in canonical data and MUST be available to diagnostics and to private debug views. It MUST NOT appear as a page title, a navigation label, a search title, or a relationship link text.

#### Scenario: A debug view shows the authoring label

- **WHEN** a maintainer inspects a placement through a private debug surface
- **THEN** the authoring label is visible alongside the display name
- **AND** the public page shows only the display name
