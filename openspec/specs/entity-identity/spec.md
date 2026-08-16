# entity-identity Specification

## Purpose

Defines how an entity gets the name a reader sees, how that name is distinguished from a designer's identifier, and what publication depends on.

## Requirements

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

### Requirement: Authored content is published, and a marker is not a filter

Every authored row MUST be published. An empty, templated or placeholder name MUST NOT withhold a page: it marks the row and it obliges the compendium to model the naming mechanism instead. Withholding a page requires evidence from game behaviour that the row is never presented to a player as itself, recorded in the descriptor, and no such case exists today.

#### Scenario: A template is published and marked

- **WHEN** a definition or item resolves a templated or empty name, which applies to 84 items and 59 character definitions
- **THEN** it keeps a public page
- **AND** the page states that the row is a template that other rows derive from
- **AND** the page lists what derives from it

#### Scenario: A loot reference proves reachability

- **WHEN** a loot list references a templated item, which the baseline reports 9 times
- **THEN** the edge is emitted normally
- **AND** neither endpoint is withheld

#### Scenario: An exclusion carries its evidence

- **WHEN** a family proposes to withhold a class of rows from publication
- **THEN** the descriptor records the game behaviour that justifies it
- **AND** the run manifest reports how many rows the exclusion covers

### Requirement: A name carries the provenance that explains it

Every published display name MUST carry how the game arrived at it: set on this row, inherited from the row's prototype, generated at runtime from an authored vocabulary, or absent. Presentation MUST state the provenance whenever it is not the first case.

#### Scenario: A generated name is explained, not sampled

- **WHEN** a character resolves no stored name and its race carries name sets
- **THEN** the display name is recorded as generated rather than as a string
- **AND** the page is titled by a descriptive label and says the game builds the name from that race's name sets when the player meets the character
- **AND** the page publishes the mechanism and links to the vocabulary rather than showing a synthesised sample

#### Scenario: An inherited name says where it came from

- **WHEN** a placement's name resolves through its prototype
- **THEN** the page states that the name comes from the character's type
- **AND** links to that type

#### Scenario: A name is genuinely absent

- **WHEN** a character has no stored name and no race with name sets, as `mannequin` does
- **THEN** the row records that no naming mechanism exists
- **AND** a diagnostic names the row and the field

### Requirement: Absence of a name is reported, never invented

When a row resolves no name at all, extraction MUST emit a diagnostic naming the row and the field, and the canonical column MUST be null. Presentation MUST state the absence rather than substitute an identifier, a row id, or a generated value.

#### Scenario: A placement with no naming mechanism

- **WHEN** a placement resolves neither a stored name, an inherited one, nor a race vocabulary
- **THEN** the canonical display-name column is null
- **AND** a diagnostic records the placement and the field
- **AND** the page says so in words rather than showing its record id

### Requirement: Authoring labels remain available as provenance

A `designer-identifier` value MUST remain in canonical data and MUST be available to diagnostics and to private debug views. It MUST NOT appear as a page title, a navigation label, a search title, or link text.

#### Scenario: A debug view shows the authoring label

- **WHEN** a maintainer inspects a placement through a private debug surface
- **THEN** the authoring label is visible alongside the display name
- **AND** the public page shows only the display name

### Requirement: Links use the target's disambiguated display label

A stored link to another entity MUST use that target node's `display_label` and route. It MUST NOT take link text from the target entity's own source name, because the graph is the single place that knows whether the target label is ambiguous.

#### Scenario: Same-named targets remain distinguishable in links

- **WHEN** a page stores links to two different entities with the same authored label
- **THEN** each link stores the target node's disambiguated display label
- **AND** the two links do not read identically while pointing at different pages

### Requirement: Page addresses use opaque stable suffixes

A published page address MUST carry a reader-facing title and an opaque stable 8-hex suffix. The address MUST NOT contain an authoring identifier, including a named asset name. If two entities resolve the same canonical slug, the build MUST fail and name both entity ids and the slug.

#### Scenario: Named assets produce opaque page addresses

- **WHEN** a named asset is published as a page
- **THEN** its address carries the reader-facing title and an opaque stable 8-hex suffix
- **AND** the address does not contain the asset name

#### Scenario: A canonical slug collision fails the build

- **WHEN** two entities resolve the same canonical slug
- **THEN** the build fails before it publishes either page
- **AND** the error names both entity ids and the canonical slug
