# content-availability Specification

## Purpose

Defines how the compendium handles content that the game marks as unavailable, so a reader learns that the content exists and that the game may not currently present it, without the compendium claiming to know that it is unreachable.

## Requirements

### Requirement: Extraction never drops a row because the game marks it unavailable

An extractor MUST NOT skip an authored row because a game flag reports the content disabled, hidden or debug-only. It MUST export the row together with the flag. Only an absent or unreadable identity may stop a row from being extracted.

#### Scenario: A disabled location is extracted

- **WHEN** a `LocationAsset` has `enabled` set to false
- **THEN** extraction exports the location with its enabled flag set to false
- **AND** the canonical row exists
- **AND** the map layer and the location page state that the game has the location switched off

#### Scenario: A disabled quest is extracted

- **WHEN** a `QuestData` has `disabled` set to true
- **THEN** extraction exports the quest and its flag
- **AND** the quest keeps its page, its phases, its rewards and its relationships

#### Scenario: An availability flag can be observed both ways

- **WHEN** an availability flag exists in the canonical schema
- **THEN** an export can produce both values for it
- **AND** no extraction filter makes one value unreachable

### Requirement: Availability is a canonical field, marked the same way everywhere

Every entity whose game asset carries an availability flag MUST store it as a canonical column, and presentation MUST mark it with one shared component and one wording. A family MUST NOT invent its own phrasing, and a page MUST NOT render an availability field that is unremarkable.

#### Scenario: Unavailable content is marked once, prominently

- **WHEN** a reader opens a page for content the game marks unavailable
- **THEN** the page shows the shared availability notice near the title
- **AND** the notice names which flag applies, such as disabled or debug-only

#### Scenario: Available content says nothing

- **WHEN** a reader opens a page for content with no availability flag set
- **THEN** the page shows no availability notice
- **AND** no field row reads `Disabled: No`

#### Scenario: Listings carry the same mark

- **WHEN** unavailable content appears in an overview table, a search result or a relationship section
- **THEN** the entry carries the same marker as the page
- **AND** the entry remains selectable

### Requirement: The compendium states the flag, not a conclusion

Wording for unavailable content MUST describe the authored flag and MUST NOT assert that a player cannot reach the content. Quest and dialogue graphs can reference disabled quests, and the game logs such a reference rather than forbidding it, so reachability is a runtime question the compendium does not answer.

#### Scenario: A disabled quest states its flag

- **WHEN** a quest page shows the disabled mark
- **THEN** the wording says that the game has this quest disabled and that other content may still reference it
- **AND** the wording does not say that the quest cannot be started or cannot be completed

#### Scenario: A reference to unavailable content stays a link

- **WHEN** published content references an entity that is marked unavailable
- **THEN** the link renders normally
- **AND** the target's availability mark is visible at the link or on arrival

### Requirement: Availability counts are visible in every export

The run manifest MUST report, per family, how many rows carry each availability flag. A build that disables content MUST make that change visible without a database query.

#### Scenario: An export reports availability

- **WHEN** an export completes
- **THEN** the manifest lists the disabled, hidden and debug-only counts per family
- **AND** a family with no availability flag reports none rather than zero
