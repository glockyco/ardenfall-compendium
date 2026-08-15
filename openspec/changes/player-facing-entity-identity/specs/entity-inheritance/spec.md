## Purpose

Defines how the compendium models Ardenfall's prototype chain, how a placed record participates in it as a leaf, how ownership of each value is recorded, and how an instance is connected to the definition it derives from.

## ADDED Requirements

### Requirement: One resolution serves every parameterized family

Extraction MUST resolve parameter values through `ParameterizedObject.parent` with one shared implementation for every family that inherits from it, and MUST export the immediate parent as a reference. A family MUST NOT reimplement resolution.

#### Scenario: An inherited value is exported as resolved

- **WHEN** a row leaves a parameter unset and an ancestor sets it
- **THEN** the exported row carries the ancestor's value
- **AND** the row carries a reference to its immediate parent

#### Scenario: A root has no parent

- **WHEN** a row has no prototype
- **THEN** its parent reference is absent rather than empty or self-referential

### Requirement: A placed record is a leaf of the chain

A record that embeds a definition copy MUST be extracted through the same resolution as a definition, differing only by its position and its record-only fields. Values the record sets itself MUST be exported as the record's values, without per-field code in the record's extractor.

#### Scenario: A placement's own values win

- **WHEN** a placement sets `startingFactions`, `itemLists`, `additionalItems`, `merchantItemLists`, `merchantGold` or `startingLevel` on its own copy
- **THEN** the exported row carries the placement's values rather than the definition's
- **AND** the counts are visible: 84 placements set factions, 44 set item lists or additional items, and 14 set merchant item lists

#### Scenario: A placement without its own value inherits

- **WHEN** a placement leaves a parameter unset
- **THEN** the exported row carries the value resolved from its definition

#### Scenario: A clone name is not an identity

- **WHEN** a record's embedded copy carries a Unity clone name such as `preset_sapper_stage1(Clone)(Clone)`
- **THEN** that name is never used as an identity or a label
- **AND** the definition is resolved from the copy's parent instead

### Requirement: Every published value records who set it

For each published field the canonical data MUST record whether the value was set on this row, inherited from an ancestor, generated at runtime, or absent. Presentation MUST be able to state that ownership without inspecting the game.

#### Scenario: Provenance distinguishes a merchant's own stock

- **WHEN** a placement sets its own merchant stock
- **THEN** the row records that the value is its own
- **AND** the page can say so

#### Scenario: Provenance explains inherited drops

- **WHEN** a placement inherits its item lists from its definition
- **THEN** the row records the ancestor as the owner
- **AND** the page attributes the drops to the character's type

### Requirement: A placed instance links to the definition it derives from

Extraction MUST export a reference from a placed instance to the definition its copy derives from, and the pipeline MUST project it as `instance_of`. The forward relationship is the instance's type; the inverse lists the placements of that type.

#### Scenario: The definition resolves through the copy's parent

- **WHEN** a placement stores a per-record copy
- **THEN** extraction resolves the definition from that copy's parent
- **AND** the reference identifies the definition by its authored asset name

#### Scenario: A type page lists its placements

- **WHEN** a definition has placements deriving from it
- **THEN** its page lists each placement
- **AND** each entry links to the placement's page and to its map position

#### Scenario: Every placement has a type

- **WHEN** the pipeline projects `instance_of` for all published authored placements
- **THEN** the edge count equals the number of published placements whose copy has a parent, currently 292
- **AND** no edge is suppressed for the target's name

### Requirement: The reader-facing type is the nearest recognisable ancestor

Type resolution MUST walk the chain from the row upward and select the first node with a player-visible name. When no ancestor has one, resolution MUST fall back to the row's race. A family MUST NOT branch on the kind of character.

#### Scenario: A named definition is the type

- **WHEN** a placement's parent is a definition with a player-visible name such as `Darvaki`
- **THEN** that definition is the reader-facing type

#### Scenario: The race is the type when the chain has no name

- **WHEN** no ancestor of a placement carries a player-visible name and the placement resolves a race
- **THEN** the race is the reader-facing type, such as `Karu Elf`, for a creature or a humanoid
- **AND** the page still links to the immediate definition as its prototype
- **AND** resolution does not branch on the character family: 93 of 96 creature definitions and all 116 humanoid definitions resolve a race
- **AND** the three definitions without a race are identified as one omission chain, `base_creature` → `mon_ato` → `mon_ato-baby`

### Requirement: Inheritance and provenance counts are reported per export

The run manifest MUST report, per family, how many rows set the display name themselves, inherit it, receive a generated one, or have none, and how many rows set each provenance-tracked field themselves.

#### Scenario: An export reports the split

- **WHEN** an export completes
- **THEN** the manifest carries those counts per family
- **AND** the display-name counts sum to the extracted row count
