## Purpose

Defines placed items and containers as first-class placed entities, so a reader can find where an item lies in the world and what a container holds.

## ADDED Requirements

### Requirement: A placed item is an entity with a position and an item reference

Each `ItemSpawner` MUST become a canonical row with its cell, its world position, a reference to the item it spawns, and its authored modifiers: enchantments, durability, ruined state and stack count. It MUST project a placement and a map marker.

#### Scenario: Placed items are extracted

- **WHEN** the walk harvests item spawners, currently 553 across 15 cells
- **THEN** each becomes a canonical row referencing its item
- **AND** each carries its cell, map and position
- **AND** each appears as a marker on its map layer

#### Scenario: An item page names where copies lie

- **WHEN** an item has placed copies in the world
- **THEN** the item page lists them
- **AND** each entry deep-links to that position on the map

#### Scenario: Authored modifiers travel with the placement

- **WHEN** a placed item carries enchantments, a durability value or a stack count
- **THEN** those values appear on the placement rather than on the item
- **AND** an enchanted placed copy links to the enchantment

#### Scenario: A placed item with an unresolvable reference

- **WHEN** a spawner's item reference cannot be resolved
- **THEN** the row records a diagnostic naming the cell and the spawner
- **AND** the placement still publishes its position

### Requirement: A container is an entity with loot, a name and a lock

Each `StaticContainer` MUST become a canonical row with its player-visible name, its loot lists, its additional items, its level, and its lock state, and MUST project a placement and a map marker.

#### Scenario: Containers are extracted

- **WHEN** the walk harvests containers, currently 135
- **THEN** each becomes a canonical row with its `containerName`
- **AND** each carries its cell, map and position

#### Scenario: Container loot connects to items

- **WHEN** a container declares item lists or additional items
- **THEN** the container page lists the items it can hold
- **AND** each of those item pages names the container as a source

#### Scenario: A locked container says so

- **WHEN** a container carries a lock
- **THEN** its page states that it is locked and the authored difficulty
- **AND** the wording describes the authored lock rather than predicting whether a player can open it

#### Scenario: A container without an authored name

- **WHEN** a container's name is the default rather than an authored one
- **THEN** the page states what kind of container it is without inventing a name
- **AND** a diagnostic records the container

### Requirement: Placed objects reuse the existing placement and map contracts

A placed item and a container MUST use the same placement table, map layer declaration and deep-link shape as every other placed entity. Neither may introduce a route-local map or link mechanism.

#### Scenario: Layers are descriptor-owned

- **WHEN** the pipeline emits map layers
- **THEN** placed items and containers appear as layers declared by their descriptors
- **AND** the map legend lists them with their own toggles

#### Scenario: Deep links match the existing shape

- **WHEN** a page links to a placed object on the map
- **THEN** the link uses the established map deep-link parameters
- **AND** selecting the marker shows that object's details
