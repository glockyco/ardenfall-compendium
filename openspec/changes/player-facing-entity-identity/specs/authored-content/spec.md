## Purpose

Defines the boundary between content the game's authors created and state the running game produced, so an export describes the build rather than the session that observed it.

## ADDED Requirements

### Requirement: Only authored content is extracted

Extraction MUST exclude rows that the running game created, and MUST use the game's own test for authorship where one exists. For character records that test is `CharacterRecord.IsEditorCreated()`. An excluded row MUST be counted and reported.

#### Scenario: A runtime-created record is not published

- **WHEN** the record table holds a record that the running game created, which currently applies to 22 of 320 character records
- **THEN** extraction excludes it
- **AND** the run manifest reports how many records the filter excluded
- **AND** no page, canonical row, map marker or edge exists for it

#### Scenario: An authored record is published

- **WHEN** a record holds a stored character definition, which currently applies to 298 of 320
- **THEN** extraction publishes it

### Requirement: An export is reproducible for a given build and save

Two exports of the same build and save MUST produce the same row counts for every family. A count that depends on how long the game ran, or where the player stood, is a defect.

#### Scenario: Session length does not change the data

- **WHEN** an export runs after the game has been loaded for a long session
- **THEN** the extracted counts equal those of an export taken immediately after the world loaded
- **AND** the manifest records the authored and filtered counts that prove it

#### Scenario: A count difference is diagnosed, not accepted

- **WHEN** an export produces a different count for a family than the previous export of the same build
- **THEN** the manifest exposes the authored and filtered counts for that family so the difference can be attributed

### Requirement: Accessors that mutate or invent are not used

Extraction MUST read authored backing data rather than accessors that generate values or write caches. Where an accessor has such an effect, the extractor MUST read the underlying field and the reason MUST be recorded next to the code.

#### Scenario: A name is read without generating one

- **WHEN** extraction reads a character's name
- **THEN** it reads the stored name parameter
- **AND** it does not call the accessor that assigns a generated name during play

#### Scenario: A position is read without writing a cache

- **WHEN** extraction reads a placement's spawn point
- **THEN** it reads the backing field, and falls back to the record transform when that field is empty
- **AND** it does not call the public accessor that populates the cache
