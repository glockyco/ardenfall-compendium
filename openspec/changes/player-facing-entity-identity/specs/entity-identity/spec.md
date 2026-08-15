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

### Requirement: Content is published unless the game's own behaviour says it is not content

The compendium MUST publish every authored row by default. Withholding a page requires evidence from game behaviour that the object is never presented to a player as itself. An absent name is NOT such evidence: it means the naming mechanism has not been understood yet, and it MUST be investigated and modelled rather than treated as grounds for exclusion.

Two facts measured on 2026-08-15 make this concrete. 57 of the 59 character definitions that resolve no stored name carry a race with a player-visible name and two name sets, so the game generates a name for them at runtime and a player always sees one. Scene spawners hold direct `CharacterData` references through `NPCRandomSpawnerGroup.NPCSelection.characterData` and `WeightedNPCRandomSpawnerGroup.manualCharacterList`, so the absence of a placement at rest does not show that a definition is never instantiated.

#### Scenario: A definition with no stored name is published

- **WHEN** a definition resolves no stored name but its race supplies name sets
- **THEN** it keeps its public page
- **AND** the page states that the game generates each character's name from that race's name sets
- **AND** the page names the race

#### Scenario: Exclusion requires behavioural evidence

- **WHEN** a family proposes to withhold pages for a class of rows
- **THEN** the descriptor records the game behaviour that justifies it, such as the chain matching that makes an item prototype stand for its descendants
- **AND** the pipeline reports how many rows the exclusion covers, so the decision stays visible in every export

#### Scenario: An excluded row remains data

- **WHEN** a row is withheld from publication on that evidence
- **THEN** its canonical row still exists
- **AND** a diagnostic names it and the rule that withheld it

#### Scenario: A placement without a name keeps its page

- **WHEN** a placement resolves no display name at all
- **THEN** it keeps its page, its canonical row and its map marker
- **AND** the page states that the game gives this character no name
- **AND** the page identifies the character by its type and its location

#### Scenario: A placement whose name comes from its type keeps its page

- **WHEN** a placement inherits its name from its prototype, as the eight `Darvaki` placements do
- **THEN** each keeps its own page titled with that name
- **AND** each page states that the name comes from the character's type
- **AND** listings disambiguate them by location

#### Scenario: An authoring artifact is never an edge target

- **WHEN** a relationship would point at a definition that resolves no display name
- **THEN** the edge is suppressed
- **AND** the source row records a diagnostic naming the predicate and the unpublishable target

### Requirement: A name carries the provenance that explains it

Every published display name MUST carry how the game arrived at it. The states are: authored on this row; inherited from the row's prototype; generated at runtime from an authored vocabulary; or genuinely absent. Presentation MUST state the provenance whenever it is not the first case.

#### Scenario: A generated name is explained, not faked

- **WHEN** a character resolves no stored name and its race carries name sets
- **THEN** the display name is recorded as generated rather than as a string
- **AND** the page says that the game builds the name from that race's name sets when the player meets the character
- **AND** the compendium shows no example name, because an example would be one roll of many

#### Scenario: An inherited name says where it came from

- **WHEN** a placement's name resolves through its prototype
- **THEN** the page states that the name comes from the character's type
- **AND** links to that type

#### Scenario: A name is genuinely absent

- **WHEN** a character has no stored name, and no race or a race with no name sets, as `mannequin` does
- **THEN** the row records that no naming mechanism exists
- **AND** a diagnostic names the row and the field

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
