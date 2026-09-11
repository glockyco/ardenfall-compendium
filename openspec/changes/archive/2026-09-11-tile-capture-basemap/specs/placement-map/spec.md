## MODIFIED Requirements

### Requirement: Map layers are descriptor-owned and data-driven

`pipeline/src/stages/emit-site-metadata.ts` MUST create each map layer from descriptor metadata. Its `source_tables_json` MUST name generalized map read-model tables, and the site map reader MUST load those declarations.

A basemap is not an entity, so it MUST NOT be declared by a descriptor and MUST NOT occupy a layer row. The map view MUST carry basemap metadata per map id instead, and the site MUST render the basemap beneath every marker layer without branching on layer identity.

#### Scenario: A descriptor declares a layer

- **WHEN** a descriptor declares map styling and a render kind
- **THEN** metadata emission writes the layer configuration and its source tables
- **AND** `site/src/lib/server/entities/location.ts` loads the configuration without entity-specific layer branching

#### Scenario: A map carries a basemap

- **WHEN** metadata emission runs for a map with a captured tile set
- **THEN** it writes the basemap bounds, pixels per unit, zoom range, and tile index reference to the map view
- **AND** no layer row is created for the basemap
- **AND** the site renders it below the marker layers
