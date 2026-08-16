## Context

The proposal records payload that the current extractors omit. The relevant readers need item modifiers, combat effects, enchantments, status chains, perks and traits.

`BuiltLookupTableItemTagAssetSource.cs:22-23` exports only tag name and description. `ExtractMelee.cs:14-17` exports damage, critical chance, durability and blocking. Its presentation fields include the hard-attack multiplier. `ExtractEquipment.cs:15-17` exports slots, minimum skill and stat type. `BuiltLookupTableStatusEffectAssetSource.cs:30-38` exports identity, tooltip, icon and hostility.

`FactionItemTag.cs:18-20` defines faction modifiers. `MeleeItemData.cs:18-20` defines omitted bleed and piercing parameters. `EquipItemData.cs:20-23` defines ordinary and built-in enchantment collections. `StatusEffectData.cs:129` defines `modifyStatusEffects`.

`PerkAsset.cs:9-17` and `TraitType.cs:8-23` define authored page data. Neither type has an extraction family. The proposal contains the evidence for these boundaries.

## Goals / Non-Goals

**Goals:**

- Give readers enough authored data to understand faction tag effects and melee combat behaviour.
- Show enchantments carried by an equipment item and status effects that modify other status effects.
- Make authored perks and traits reachable through stable compendium pages.
- Preserve provenance and diagnostics for references that cannot resolve.

**Non-Goals:**

- Reclassifying fields already exported by the current adapters.
- Reconstructing runtime damage calculations or applying effects in the exporter.
- Choosing a shared storage shape before the field inventory is complete.
- Adding character build recommendations or gameplay balance analysis.

## Decisions

### 1. Inventory the consumer-visible field set before choosing storage

The implementation will compare each game type with its consumers and current extractor output. The inventory will distinguish reader-facing values from runtime-only values. It will record whether each value is a scalar, reference, list or structured object.

Typed columns are preferred for stable values that have dedicated page or table behaviour. Relationships are preferred for cross-entity references. Structured JSON remains an option for nested authored values that have no shared read model yet.

The open question is whether nested modifier and combat data should use typed fields, structured JSON or both. The alternatives are typed fields for queryability, JSON for fidelity, or a typed summary with JSON provenance.

### 2. Resolve references through existing entity identity

Faction references, enchantments and chained status effects will resolve through the same GUID lookup and missing-reference diagnostics used by item and status extractors. A missing reference will remain visible as a diagnostic. It will not become a guessed label.

The open question is whether a modifier that points at several factions should produce one relationship per faction or one structured modifier record. The alternatives are relationship rows for navigation, structured records for modifier grouping, or both.

### 3. Model perks and traits as authored entities

Perks and traits will receive source descriptors, canonical rows and page routes only after their complete reader-facing fields are inventoried. Their icons and references will use existing asset and identity contracts.

The open question is whether perk effects and requirements belong in relationships, structured data or separate entities. The alternatives are relationship edges for navigation, JSON for authored order, or separate entities for reusable requirements and effects.

### 4. Keep runtime behaviour out of extraction

The extractor will copy authored values and references. It will not evaluate faction matching, bleed application, status modification or perk eligibility. The reader model will describe authored behaviour without claiming a runtime result.

## Risks / Trade-offs

- A broad melee field inventory can expose implementation details that readers do not need. The consumer review will remove runtime-only values before schema work.
- Nested enchantments and status modifiers can lose authored order if they become independent rows. The source order will be retained when the chosen shape permits it.
- Perk and trait pages can create new navigation surfaces. Identity and availability checks will run before routes become public.
- A missing game GUID can block a relationship. Diagnostics will make the omission explicit instead of publishing an ambiguous link.
