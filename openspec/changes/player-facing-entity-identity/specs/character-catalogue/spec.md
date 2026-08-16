## Purpose

Defines the two reader-facing character families, what each page answers for a player, and how a character with no authored name of its own is presented.

## ADDED Requirements

### Requirement: Characters are the placed characters a player can meet

`/characters` MUST hold every authored placement. A page MUST answer who this character is: the name the game shows and where that name comes from, where the character stands, what type the character is, and the quests, dialogue, factions, stock and drops attached to them.

#### Scenario: A named individual gets a page

- **WHEN** a placement sets its own name and the value is a display name
- **THEN** `/characters/<slug>` exists titled with that name, such as `Saya Sako`
- **AND** the page links to the character's type, its map position, and its containing location

#### Scenario: A designer identifier never titles the page

- **WHEN** a placement carries both an authored name and a `customFriendlyID` such as `Grainery Owner`
- **THEN** the page title is the authored name
- **AND** the identifier appears on no public surface

#### Scenario: A merchant's own stock is presented as the character's

- **WHEN** a placement sets its own merchant item lists, gold or categories
- **THEN** the page lists what the character sells
- **AND** the page states that the stock is configured on this character rather than on its type
- **AND** each stocked item names the character as a source of that item

#### Scenario: An inherited name is published with its provenance

- **WHEN** a placement resolves its name from its prototype
- **THEN** its page is titled with that name
- **AND** the page states that the name comes from the character's type and links to it
- **AND** listings show the location so same-named placements are distinguishable

#### Scenario: A character the game names at runtime

- **WHEN** a placement resolves no stored or inherited name but its race supplies name sets
- **THEN** the page is titled by a descriptive label such as `Karu Elf`, marked as a description
- **AND** the page says the game builds the character's name from that race's name sets when the player meets them
- **AND** the title carries no indefinite article, so listings and search sort by the type

### Requirement: Character types are the catalogue of what those characters are

`/character-types` MUST hold every character definition. A page MUST answer what this kind of character is: its name or its race, what it can drop, its factions, what derives from it, and every placement that derives from it.

#### Scenario: A creature type page answers where it appears

- **WHEN** a definition such as `Darvaki` has placements deriving from it
- **THEN** its page lists them
- **AND** each entry deep-links to that placement on the map

#### Scenario: Drops connect items to types

- **WHEN** a definition can drop an item
- **THEN** the item page names the definition as a source
- **AND** the definition page lists the item

#### Scenario: An item page names sellers and droppers

- **WHEN** a published item is in a placement's merchant stock or drop references
- **THEN** the item page lists the character under `Sold by` or `Dropped by`
- **AND** the character page lists the stocked item under `Sells`
- **AND** a placement-owned drop uses the same drop relation as a definition-owned drop
- **AND** the relationship evidence states which placement or definition supplied the reference

#### Scenario: An unresolvable placement item reference is diagnosed

- **WHEN** a placement references an item that has no published item page
- **THEN** the pipeline emits a diagnostic for that reference
- **AND** it does not emit a relationship edge for the unresolved item

#### Scenario: A template definition is published as a template

- **WHEN** a definition resolves no name of its own, which applies to 59 definitions
- **THEN** it keeps a page
- **AND** the page states that it is a template, names its race, and lists what derives from it
- **AND** the page states whether any placement uses it directly

### Requirement: Navigation names the reader's model

Navigation MUST label the two families as the reader understands them and MUST NOT expose extraction vocabulary. `Placed characters` MUST NOT appear as a public label or route.

#### Scenario: The navigation after the cutover

- **WHEN** a reader loads any page
- **THEN** navigation offers `Characters` and `Character types`
- **AND** no entry reads `Placed characters`

#### Scenario: Only current routes are published

- **WHEN** a reader follows an old `/placed-characters/<slug>` URL
- **THEN** the site returns its not-found page
- **AND** the not-found page explains that a page may have existed in an earlier snapshot
- **AND** no legacy route is published for a record that is no longer in the current snapshot

### Requirement: Dialogue is presented by the character who speaks it

Authored dialogue MUST render on the page of the character who speaks it, and on the quest that owns the dialogue graph. No dialogue may depend on a page that does not exist.

#### Scenario: A quest character keeps dialogue on both surfaces

- **WHEN** a quest character carries a dialogue graph, including one with no authored name
- **THEN** the character page renders the dialogue
- **AND** the quest page lists the character and its lines

### Requirement: Every placed character remains on the map

Every authored placement MUST keep its placement row and its map marker.

#### Scenario: Marker coverage after the cutover

- **WHEN** the pipeline emits map points for placed characters
- **THEN** the count equals the number of authored placements with a resolvable position
- **AND** a marker for a character the game names at runtime carries its descriptive label
