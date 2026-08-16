## Purpose

Defines the reader-facing race entity. A race asset can be a prototype or a gender/age variant in a `CharacterRace` parent chain. The compendium publishes the race a reader recognises, not each internal asset. Race name and name sets remain authored game data; designer asset identifiers are never presentation text.

## ADDED Requirements

### Requirement: Race identity follows the parent chain

The extractor MUST publish each race asset's parent reference and the provenance of its resolved `raceName`. The canonical model MUST group a record with the topmost ancestor in its parent chain that resolves the same non-empty player-visible name. It MUST NOT group by equal name strings alone or parse an asset name.

#### Scenario: A race with several variants is one page

- **WHEN** a chain contains a named base and gender or age variants that resolve the same name
- **THEN** the compendium publishes one page for the topmost record in that same-name chain
- **AND** the page lists every variant and that variant's ordered name-set references
- **AND** no asset identifier appears as a title, listing label, link text, or disambiguator

#### Scenario: A variant authors the same text again

- **WHEN** a descendant sets `raceName` to the same text as its parent
- **THEN** it remains a variant of the reader-facing race
- **AND** the grouping uses the parent reference and resolved-name data, not string matching or asset-name patterns

#### Scenario: A race has one variant

- **WHEN** a named race has no descendants in its same-name chain
- **THEN** it is published as one page with one variant and that variant's name sets

#### Scenario: A variant has no name sets

- **WHEN** one variant in a named race has no name-set references
- **THEN** that variant remains on the race page with an empty vocabulary
- **AND** the page states that the variant has no authored name-set vocabulary

### Requirement: Nameless creature races are retained but not published

The pipeline MUST retain every extracted race record in canonical storage for references and diagnostics. A race chain that resolves no player-visible name and has no name-set vocabulary MUST have no public race page. This is evidence-based: 95 of the 112 race records resolve no name in the live export, and 93 of 96 creature definitions carry their own authored names; those definitions, rather than internal race assets, provide reader-facing identity. The remaining three creature definitions are the documented raceless omission chain. The live export therefore yields five reader-facing race pages.

#### Scenario: A nameless record is not a page

- **WHEN** a race has no resolved player-visible name and no name sets
- **THEN** it remains in canonical data
- **AND** its entity node has no page
- **AND** no asset name is used as its public label

#### Scenario: A named race is published

- **WHEN** a race chain resolves a player-visible name such as `Karu Elf`, `Obsidian Dwarf`, or `Sand Elf`
- **THEN** its canonical root has a public page
- **AND** the page names the race and lists its variants

### Requirement: Name sets are published as vocabulary

A race variant MUST preserve name-set order. The race page MUST explain that a character without an authored name receives one word from each set, joined in order, with each word synthesised by a Markov chain at the set's generation order from that set's seed vocabulary. Shared name sets are published once and referenced by every variant that uses them. The compendium MUST NOT publish a generated example name, `[No Sets]`, or `Missing Name` as a player-facing name.

### Requirement: Extraction does not call the mutating name accessor

The extractor MUST read the backing `raceName` parameter and its `IsSet` state, not a mutating public accessor. It MUST report missing resolved names diagnostically and retain the parent reference so canonicalisation can follow the chain.

### Requirement: Every character states its race

A character definition and placement MUST link to a published named race when one resolves. A character whose race is one of the retained nameless creature races MUST use its own authored character or creature name and MUST NOT expose the race asset name. A character with no race MUST record a diagnostic for the raceless chain `base_creature` → `mon_ato` → `mon_ato-baby`.
