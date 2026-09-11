## Purpose

Defines what the world instantiates, so the compendium knows which character definitions a player can actually meet instead of inferring it from records that exist at rest.

## ADDED Requirements

### Requirement: World spawns are extracted with the definition they instantiate

Each `LocalNPCSpawner` MUST export a reference to its `characterDataAsset`, its cell and its position. Each `RecordNPCSpawner` MUST export the record it refers to, so the scene side of an existing placement is known.

#### Scenario: Local spawns name their definition

- **WHEN** the walk harvests local NPC spawners, currently 55
- **THEN** each exports the character definition it spawns
- **AND** each carries its cell, map and position

#### Scenario: Record spawners resolve to known placements

- **WHEN** the walk harvests record NPC spawners, currently 62
- **THEN** each resolves to a record already extracted from the record table
- **AND** a reference that does not resolve is diagnosed

### Requirement: A definition states whether the world instantiates it

A character definition page MUST state how the world reaches it: through placements, through world spawners, or not at all in the authored scenes. The compendium MUST NOT claim a definition is unused when the evidence is only an absence of records.

#### Scenario: A definition reached only by a spawner

- **WHEN** a definition has no placement but a world spawner references it
- **THEN** its page lists the spawn locations
- **AND** the page states that the world spawns it rather than placing it

#### Scenario: A definition with no world reference

- **WHEN** neither a placement nor a spawner in any authored scene references a definition
- **THEN** the page states that no authored placement or spawner references it
- **AND** the page does not assert that a player cannot meet it, because random spawner groups can select definitions at runtime

#### Scenario: The counts are reported

- **WHEN** an export completes
- **THEN** the manifest reports how many definitions are reached by placements, by spawners, by both, and by neither
