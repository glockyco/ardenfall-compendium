## Purpose

Defines the authored item and effect data that readers can see when the game uses it to change combat, equipment or character options.

## ADDED Requirements

### Requirement: Faction item tags explain their stat modifications

A faction item tag MUST identify the affected factions, the modifier for each faction, and whether matching modifiers stack. The item page MUST show this information when the tag has authored modifiers.

#### Scenario: A tag modifies a faction

- **WHEN** an item uses a faction tag with an authored modifier
- **THEN** the tag page states which faction the modifier affects
- **AND** the page states the modifier outcome
- **AND** the page states whether multiple matching modifiers stack

#### Scenario: A tag has no modifiers

- **WHEN** a faction tag has no authored modifiers
- **THEN** its page states that it has no faction modifier
- **AND** the page does not show a fabricated faction link

### Requirement: Melee pages describe authored combat effects

A melee item page MUST expose authored combat effects beyond the values already present in the current item presentation. This includes bleed, stun, piercing, stealth, knockback, parry and stamina effects when authored.

#### Scenario: A melee item applies bleed

- **WHEN** a melee item has authored bleed chance, bleed effect or bleed multiplier
- **THEN** its page states the bleed behaviour
- **AND** a referenced status effect remains a navigable link when its identity resolves

#### Scenario: A melee item has additional combat effects

- **WHEN** a melee item has authored stun, piercing, stealth, knockback, parry or stamina behaviour
- **THEN** its page states each authored behaviour
- **AND** an absent behaviour is not shown as an invented value

### Requirement: Equipment pages list carried enchantments

An equipment item page MUST list every authored enchantment it carries, including its level and whether the source is an ordinary or built-in enchantment collection.

#### Scenario: Equipment carries enchantments

- **WHEN** an equipment item has one or more authored enchantments
- **THEN** its page lists each enchantment
- **AND** each entry states its authored level
- **AND** each entry identifies its source collection

#### Scenario: Equipment has no enchantments

- **WHEN** an equipment item has no authored enchantments
- **THEN** its page does not show an empty enchantment entry
- **AND** the item remains valid equipment content

### Requirement: Status effects disclose chained modifications

A status-effect page MUST name every authored status effect that it modifies while active or on application. A resolved target MUST link to the target status-effect page.

#### Scenario: A status effect modifies another effect

- **WHEN** a status effect contains an authored modification target
- **THEN** its page names the target status effect
- **AND** the page states the authored level adjustment information
- **AND** the target link identifies an unresolved target when the target identity is missing

#### Scenario: A status effect has no chained modification

- **WHEN** a status effect has no authored modification targets
- **THEN** its page shows no fabricated chained-effect entry

### Requirement: Authored perks have reader-facing pages

Every authored perk with a stable source identity MUST reach a compendium page that shows its name, description, requirements and authored effects.

#### Scenario: A perk is present in the game data

- **WHEN** an authored perk has a stable identity
- **THEN** a reader can open its compendium page
- **AND** the page shows its authored description
- **AND** the page lists its requirements and effects

### Requirement: Authored traits have reader-facing pages

Every authored trait with a stable source identity MUST reach a compendium page that shows its name, descriptions, icon and stat requirement when present.

#### Scenario: A trait has a stat requirement

- **WHEN** an authored trait enables a stat requirement
- **THEN** a reader can open its compendium page
- **AND** the page states the required stat and threshold
- **AND** the page shows the trait descriptions

#### Scenario: A trait has no stat requirement

- **WHEN** an authored trait does not enable a stat requirement
- **THEN** its page shows no fabricated requirement
- **AND** the trait remains reachable by its stable identity
