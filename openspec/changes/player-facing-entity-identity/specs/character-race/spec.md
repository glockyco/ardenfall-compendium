## Purpose

Defines race as a published entity, because it is the authored naming vocabulary the game uses for every kind of character, including characters the game does not name individually. Race is not a humanoid-only classification.

## ADDED Requirements

### Requirement: Race is extracted as an entity with its naming vocabulary

The compendium MUST extract `CharacterRace` as an entity, including its player-visible name and the name sets it uses to generate character names. A race MUST record how many name sets it carries and in what order they combine.

#### Scenario: A named race is published

- **WHEN** a race carries a player-visible name, as `Karu Elf`, `Obsidian Dwarf` and `Sand Elf` do
- **THEN** the race has a canonical row and a public page
- **AND** the page names the race and lists the character definitions that use it

#### Scenario: A character race without its own name

- **WHEN** a race carries no player-visible name, as a per-character race such as `race_balati` does
- **THEN** the race is still extracted
- **AND** its identity in presentation comes from the character definitions that use it rather than from its asset name
- **AND** race remains the naming vocabulary for both creature and humanoid definitions; 93 of 96 creatures and all 116 humanoids resolve a race

#### Scenario: Name sets are published as vocabulary

- **WHEN** a race carries name sets
- **THEN** the race row records the count and combination order of those sets
- **AND** the page explains that a character of this race without an authored name receives one built from them

#### Scenario: The generator is described as what it is

- **WHEN** a race page explains its naming
- **THEN** it states that each name set contributes one word, that the words join in set order, and that each word is synthesised by a Markov chain of the set's generation order from that set's seed vocabulary
- **AND** it gives the seed count for each set, such as 361 for the Karu Elf female set and 948 for the male set

### Requirement: Extraction does not call the mutating name accessor

The game getter is `if (Application.isPlaying && charName.Get().name == "") charName.Set(new CharacterRandomName(Race)); return charName?.Get()?.name ?? "Missing Name";`. In play mode, it generates a name from the race and writes that name into the definition when the stored name is empty. Extraction MUST read the backing `charName` field instead, because calling `CharName` mutates the data being read.

#### Scenario: Game literals are not presented as names

- **WHEN** a race has no name sets
- **THEN** the game generator produces the literal `[No Sets]`
- **AND** the compendium does not present `[No Sets]` as a player-facing name
- **WHEN** no name resolves at all
- **THEN** the getter produces the literal `Missing Name`
- **AND** the compendium records the absence instead of presenting `Missing Name` as a player-facing name

#### Scenario: The raceless chain cannot generate a name

- **WHEN** a definition has neither a race nor an authored name
- **THEN** the game's name-generation constructor dereferences the null race and cannot name the definition
- **AND** this condition is reported for the one chain `base_creature` → `mon_ato` → `mon_ato-baby`

#### Scenario: The seed vocabulary is published

- **WHEN** a reader wants to know how a race's names are formed
- **THEN** the seed vocabulary of each name set is published as authored content
- **AND** a name set shared by several races is published once and referenced by each

#### Scenario: No synthesised name is published

- **WHEN** the compendium presents a race's naming
- **THEN** it publishes no output of the generator
- **AND** the reason is stated: such a string would be one roll of the compendium's own, indistinguishable on the page from a name the game's designers authored

### Requirement: Every character states its race

A character definition and a placement MUST both link to the race that supplies their appearance and their generated name. A character whose race is missing MUST record a diagnostic rather than present an empty field.

#### Scenario: A character links to its race

- **WHEN** a character definition resolves a race
- **THEN** the character page names the race and links to it
- **AND** the race page lists that character among its own

#### Scenario: A character without a race

- **WHEN** a character resolves no race, which occurs for three definitions in one omission chain in the current build
- **THEN** a diagnostic names each character and the field
- **AND** the page states that the game defines no race for each member of `base_creature` → `mon_ato` → `mon_ato-baby`

### Requirement: A character the game names at runtime is titled by description

A character whose name is generated has no name that can title its page, because every player sees a different one. Its title MUST be a descriptive label composed only from facts the compendium already publishes, in a declared order, beginning with the race. The label MUST read as a description rather than as a proper name, and MUST NOT be a string the generator produced.

#### Scenario: A generated-name character is titled descriptively

- **WHEN** a reader opens a character whose name the game generates
- **THEN** the title is a description such as `A Karu Elf`
- **AND** the page says the game builds this character's name from the race's name sets when the player meets them
- **AND** the page links to the race and to that vocabulary

#### Scenario: Descriptive titles are distinguished by published facts

- **WHEN** several characters would take the same descriptive label
- **THEN** the label extends with the next published fact in the declared order, such as the character's faction
- **AND** a listing shows the location so that placements of the same description remain distinguishable

#### Scenario: A descriptive title is never mistaken for a name

- **WHEN** a descriptive label appears as a title, in a listing, in search, or as link text
- **THEN** it is marked as a description
- **AND** the page states that the game gives this character no authored name
