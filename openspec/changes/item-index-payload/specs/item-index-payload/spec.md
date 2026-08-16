## Purpose

Defines the item index transfer budget and the reader-visible data contract for filtering and paging.

## ADDED Requirements

### Requirement: The item index sends only its reader-facing overview data

The item index MUST ship no item data beyond the fields required by its rendered columns, filter controls, table presentation and item routes. The index MUST NOT hydrate item-detail fields that the page does not render.

#### Scenario: An item index renders its overview

- **WHEN** a reader opens the item index
- **THEN** every rendered column has the data required for its visible value
- **AND** filtering and paging use the shipped overview data
- **AND** no detail-only item field is included solely for a future interaction

#### Scenario: The overview contract changes

- **WHEN** a column, filter or table interaction changes
- **THEN** the index payload changes only to support that reader-visible contract
- **AND** the read model remains the single source for overview values

### Requirement: The item index stays within its recorded release budget

The build MUST enforce the item-index payload budget recorded by the current-release measurement. The recorded budget MUST include its payload boundary, release evidence and measurement conditions.

#### Scenario: The current release meets the budget

- **WHEN** the build measures the item index at the recorded conditions
- **THEN** the measured payload is no larger than the recorded budget
- **AND** the build reports the measurement and budget evidence

#### Scenario: A change exceeds the budget

- **WHEN** the measured item-index payload exceeds the recorded budget
- **THEN** the build fails the page-weight check
- **AND** the failure reports the measured value, budget value and payload boundary

### Requirement: Item index interactions preserve the measured reader contract

The item index MUST preserve the filtering and paging behaviour measured for the selected release design. A performance change MUST NOT silently remove a reader-visible result.

#### Scenario: A reader filters and pages items

- **WHEN** a reader searches, selects a variant filter or changes page
- **THEN** the visible rows match the active criteria
- **AND** the page control reflects the available filtered rows
- **AND** the interaction remains within the recorded interaction budget
