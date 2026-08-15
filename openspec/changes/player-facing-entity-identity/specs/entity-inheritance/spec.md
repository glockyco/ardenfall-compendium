## Purpose

Defines how the compendium models Ardenfall's prototype chain, how it decides that an authored object is a prototype rather than a subject, and how a placed instance is connected to the definition it derives from.

## ADDED Requirements

### Requirement: The prototype chain is resolved once for every parameterized family

Extraction MUST resolve parameter values through `ParameterizedObject.parent` for every family that inherits from it, and MUST export the immediate parent as a reference. Each family MUST use the same resolution, not a family-specific reimplementation.

#### Scenario: An inherited value is exported as a resolved value

- **WHEN** a definition leaves a parameter unset and its prototype sets it
- **THEN** the exported row carries the prototype's value
- **AND** the row carries a reference to the immediate parent

#### Scenario: A root object has no parent

- **WHEN** an object has no prototype
- **THEN** its parent reference is absent rather than empty or self-referential

### Requirement: A prototype is a definition without a display name

Prototype classification MUST use the shared display-name test and nothing else. A definition that resolves no display name is a prototype. A definition that resolves one is a subject, whether or not other objects derive from it.

#### Scenario: A named definition with descendants stays public

- **WHEN** a definition resolves a display name and other objects derive from it
- **THEN** it keeps its public page
- **AND** it lists what derives from it

#### Scenario: A role preset is classified as a prototype

- **WHEN** a definition such as `preset_myst-elf_peasant` resolves no display name
- **THEN** it is a prototype
- **AND** it has no public page
- **AND** it is not an edge target

### Requirement: A placed instance links to the definition it derives from

For each placed instance whose stored data derives from an authored definition, extraction MUST export a reference to that definition, and the pipeline MUST project an `instance_of` edge from the instance to the definition. The forward relationship is the instance's type; the inverse lists the placements of that type.

#### Scenario: A placement resolves its definition through the clone's parent

- **WHEN** a placement stores a per-record copy whose own asset name is a Unity clone name
- **THEN** extraction resolves the definition from the copy's parent
- **AND** the exported reference identifies that definition by its authored asset name

#### Scenario: A type page lists its placements

- **WHEN** a definition with a display name has placements deriving from it
- **THEN** its page lists each placement
- **AND** each entry links to the placement's page when it has one, and to its map position otherwise

#### Scenario: A placement whose type is a prototype

- **WHEN** a placement derives from a definition that resolves no display name
- **THEN** no `instance_of` edge is emitted
- **AND** the placement records a diagnostic naming the unpublishable definition
- **AND** the placement page, when it exists, states that its type is not published

### Requirement: Inheritance counts are reported on every export

Extraction MUST report, per parameterized family, how many rows carry an own value for the display name, how many inherit one, and how many resolve none. A change in that split MUST be visible without reading the database.

#### Scenario: An export reports the split

- **WHEN** an export completes
- **THEN** the run manifest carries the own, inherited and absent counts for each family
- **AND** the counts sum to the extracted row count for that family
