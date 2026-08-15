## Purpose

Defines the two reader-facing character families, what each page answers for a player, and where a character that has no page is presented instead.

## ADDED Requirements

### Requirement: Characters are the placed characters a player can meet

`/characters` MUST hold every extracted placement. A page MUST answer who this character is: the name the game shows and where that name comes from, where the character stands, what type the character is, and the quests, dialogue and factions attached to them.

#### Scenario: A named individual gets a page

- **WHEN** a placement sets its own `charName` and the value passes the display-name test
- **THEN** `/characters/<slug>` exists
- **AND** the title is the authored name, such as `Saya Sako`
- **AND** the page links to the character's type, its map position, and its containing location

#### Scenario: A designer identifier never titles the page

- **WHEN** a placement carries both an authored name and a `customFriendlyID` such as `Grainery Owner`
- **THEN** the page title is the authored name
- **AND** the identifier appears on no public surface

#### Scenario: An inherited name is published with its provenance

- **WHEN** a placement resolves its name from its prototype rather than setting its own
- **THEN** its page is titled with that name
- **AND** the page states that the name comes from the character's type and links to the type
- **AND** an overview listing shows its location so that same-named placements are distinguishable

#### Scenario: A placement with no name is published as unnamed

- **WHEN** a placement resolves no name, including a placement that stores no character data
- **THEN** its page exists and states that the game gives this character no name
- **AND** the page shows its location and, when it has one, its type
- **AND** the page does not display the record id as a title

### Requirement: Character types are the catalogue of what those individuals are

`/character-types` MUST hold definitions that resolve a display name. A page MUST answer what this kind of character is: its name, what it can drop, its factions, and every placement that derives from it.

#### Scenario: A creature type page answers where it appears

- **WHEN** a definition such as `Darvaki` has 8 placements deriving from it
- **THEN** its page lists 8 placements
- **AND** each entry deep-links to that placement on the map

#### Scenario: Drops connect items to types

- **WHEN** a definition can drop an item
- **THEN** the item page names the definition as a source
- **AND** the definition page lists the item

#### Scenario: A prototype definition has no page

- **WHEN** a definition resolves no display name
- **THEN** `/character-types` has no page for it
- **AND** it appears in no navigation, sitemap or search result

### Requirement: Navigation names the reader's model

Navigation MUST label the two families as the reader understands them and MUST NOT expose extraction vocabulary. `Placed characters` MUST NOT appear as a public label or route.

#### Scenario: The navigation after the cutover

- **WHEN** a reader loads any page
- **THEN** navigation offers `Characters` and `Character types`
- **AND** no entry reads `Placed characters`

#### Scenario: Old routes keep working

- **WHEN** a reader follows a shipped `/placed-characters/<slug>` URL
- **THEN** the site redirects to the character's new page when it has one
- **AND** otherwise redirects to its type's page, or to its map position when the type is unpublished

### Requirement: Dialogue is presented by a page that exists

Authored dialogue MUST render on the page of the character who speaks it when that character has a page, and on the quest that owns the dialogue graph otherwise. No dialogue may be lost because a character has no display name.

#### Scenario: A named quest character keeps dialogue on both surfaces

- **WHEN** a quest character has an authored name
- **THEN** the character page renders the dialogue
- **AND** the quest page continues to list the character and its lines

#### Scenario: An unnamed quest character's dialogue moves to the quest

- **WHEN** a quest character resolves no display name, as the tutorial's dying man does
- **THEN** the quest page renders that dialogue
- **AND** the quest page labels the speaker with the quest's own role label and states that the character is unnamed

### Requirement: Every placed character remains on the map

Removing a page MUST NOT remove world presence. Every extracted placement MUST keep its placement row and its map marker, regardless of whether it has a page.

#### Scenario: Marker coverage after the cutover

- **WHEN** the pipeline emits map points for placed characters
- **THEN** the count equals the number of extracted placements with a spawn point
- **AND** markers for placements without a page carry their type's name or state that the character is unnamed
