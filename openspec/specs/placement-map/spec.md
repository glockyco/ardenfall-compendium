# placement-map Specification

## Purpose

Defines how positioned entities become canonical placements, generalized map rows, and descriptor-driven map layers.

## Requirements

### Requirement: Positioned entities use the generalized placement table

`pipeline/src/sql/location-ddl.ts` MUST define `placements` with entity and instance identity. `pipeline/src/entities/location/canonicaliser.ts` and `pipeline/src/entities/portal/canonicaliser.ts` MUST write positioned rows there.

#### Scenario: A positioned entity is canonicalised

- **WHEN** a location or portal row has a valid position
- **THEN** canonicalisation writes its entity id, instance id, map id, coordinates, elevation, and source reference to `placements`
- **AND** the placement key identifies the entity and instance together

### Requirement: The world-to-map transform runs once in canonicalisation

`pipeline/src/entities/location/canonicaliser.ts` MUST convert source coordinates to map coordinates in `mapPointUnchecked`. The conversion MUST map world x to map x, world z to map y, and world y to elevation.

#### Scenario: A location position is projected

- **WHEN** canonicalisation receives a finite source position
- **THEN** it stores the converted values in `placements`
- **AND** no later pipeline or site stage applies another coordinate transform

### Requirement: Map points and volumes are generalized

`pipeline/src/map/read-models.ts` MUST emit `map_points` and `map_volumes` for entity and instance identities. Entity map projections in `pipeline/src/entities/registry.ts` MUST populate these tables from canonical rows.

#### Scenario: A map layer reads placed rows

- **WHEN** map read-model emission runs for a descriptor with a map projection
- **THEN** it writes generalized point or volume rows
- **AND** each row preserves the entity id and instance id

### Requirement: Map layers are descriptor-owned and data-driven

`pipeline/src/stages/emit-site-metadata.ts` MUST create each map layer from descriptor metadata. Its `source_tables_json` MUST name generalized map read-model tables, and the site map reader MUST load those declarations.

#### Scenario: A descriptor declares a layer

- **WHEN** a descriptor declares map styling and a render kind
- **THEN** metadata emission writes the layer configuration and its source tables
- **AND** `site/src/lib/server/entities/location.ts` loads the configuration without entity-specific layer branching

### Requirement: The site does not transform coordinates

`site/src/lib/server/entities/location.ts` MUST read `map_x`, `map_y`, and `elevation` from generated map rows. It MUST pass those values to the map view without applying a world-to-map conversion.

#### Scenario: The map view reads a point

- **WHEN** the site loads a map point
- **THEN** its position uses the stored map x and map y values
- **AND** its elevation uses the stored elevation value
