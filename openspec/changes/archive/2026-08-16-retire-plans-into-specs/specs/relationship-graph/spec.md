## Purpose

Defines the durable entity graph, its relationship sections, its predicate registry, and its integrity audits.

## ADDED Requirements

### Requirement: The pipeline emits graph nodes and edges

`pipeline/src/relationships/relationship-graph.ts` MUST define durable node and edge tables. `pipeline/src/stages/emit-read-models.ts` MUST run entity emitters before graph sections and audits.

#### Scenario: An entity relationship is emitted

- **WHEN** an entity read-model emitter resolves a relationship
- **THEN** it writes a node for each participating entity
- **AND** it writes an edge with source, target, predicate, label, and evidence
- **AND** the graph stage processes the edge after entity emitters finish

### Requirement: Every relationship predicate has one registry entry

`pipeline/src/relationships/registry.ts` MUST hold the single predicate registry. `pipeline/src/relationships/relationship-sections.ts` MUST reject an emitted edge whose predicate is absent from that registry.

#### Scenario: An emitter uses an unknown predicate

- **WHEN** section emission reads an edge with an unregistered predicate
- **THEN** it throws an error naming the predicate
- **AND** it does not write a relationship section for that edge

### Requirement: Relationship sections belong to detail pages

`pipeline/src/relationships/relationship-sections.ts` MUST create sections only for nodes with detail pages and registered section titles. `site/src/lib/server/entities/relationship.ts` MUST read those sections from the generated table.

#### Scenario: A map-only entity has a relationship

- **WHEN** a map-only entity emits an edge with no section title
- **THEN** the edge remains in `entity_edges`
- **AND** no relationship section is created for the map-only entity

### Requirement: The graph audit reports missing targets

`pipeline/src/relationships/relationship-graph.ts` MUST run `auditEntityGraph` after all read-model emitters. A target node missing from `entity_nodes` MUST produce a fatal `relationshipMissingTarget` diagnostic.

#### Scenario: An edge target is absent

- **WHEN** the audit finds an edge whose target node does not exist
- **THEN** it records the edge id and target identity in the diagnostic
- **AND** `pipeline/src/stages/emit-read-models.ts` rejects the graph

### Requirement: Link labels are disambiguated by the graph

`pipeline/src/stages/emit-entity-display-labels.ts` and `pipeline/src/relationships/entity-links.ts` MUST derive reader-facing labels from graph nodes. A repeated page label MUST gain the target short id before relationship consumers use it.

#### Scenario: Two targets share a page label

- **WHEN** a relationship points to two page targets with the same label
- **THEN** their stored display labels are distinct
- **AND** `site/src/lib/server/entities/relationship.ts` returns those distinct labels
