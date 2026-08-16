## Why

The 2026-08-02 program survey and repository health audit found authored payload that the extractor does not preserve.

The `FactionItemTag` game type defines `modifiers` and `multipleModifiersStackable` in `.decompiled/steam-22145060-63c576261184/csharp/Ardenfall/Item/FactionItemTag.cs`.

`mod/src/Entities/ItemTag/BuiltLookupTableItemTagAssetSource.cs` reads only `tagName` and `description`.

The game stores recipe ingredients on `PotionRecipe.recipe`, not on `FactionItemTag`.

`mod/src/Entities/PotionRecipe/LoadedPotionRecipeAssetSource.cs` already reads those ingredient tags and counts.

Therefore, the audit combines two different payloads and must not claim that item-tag extraction drops recipe ingredients.

`mod/src/Entities/StatType/LoadedStatTypeAssetSource.cs` reads both `affects` and `skillAffects`.

`mod/src/Entities/StatType/StatTypeSnapshot.cs` emits both fields.

The survey claim that stat-type extraction drops these fields contradicts the current extractor.

`mod/src/Entities/Location/BuiltLookupTableLocationAssetSource.cs` reads `fastTravelPosition` and `volumes` from `LocationAsset`.

`mod/src/Entities/Location/LocationSnapshot.cs` preserves both fields.

The survey claim that location extraction drops these fields also contradicts the current extractor.

The item adapters read melee damage and critical chance, equipment slots, and both slate spell references.

`mod/src/Entities/Item/Adapters/ExtractMelee.cs` still omits bleed data and other combat fields.

`mod/src/Entities/Item/Adapters/ExtractEquipment.cs` omits static enchantment arrays.

`mod/src/Entities/Item/Adapters/ExtractSlateSpell.cs` already reads `spellData` and `secondarySpellData`.

`mod/src/Entities/StatusEffect/BuiltLookupTableStatusEffectAssetSource.cs` does not read `StatusEffectData.modifyStatusEffects`.

The `PerkAsset` and `TraitType` game types have no extraction family under `mod/src/Entities/`.

These confirmed gaps need an owner before the plan directory is removed.

## What Changes

- Record `FactionItemTag.modifiers` as an open extraction finding.
- Record the missing melee bleed and combat payload with `ExtractMelee.cs` as its source.
- Record the missing equipment enchantment payload with `ExtractEquipment.cs` as its source.
- Record `StatusEffectData.modifyStatusEffects` with its game type and status-effect source.
- Record the absent `PerkAsset` and `TraitType` extraction families.
- Remove the stale stat-type, location, item-slot, and slate-reference claims from this finding.
- Decide whether each retained payload belongs in typed fields, relationships, or structured JSON.
- Decide whether traits and perks need entities, relationships, or a separate change.
- Define the complete field set from game consumers before implementation.

The proposal does not select any of these options.

## Capabilities

### New Capabilities

- `dropped-authored-payload`: Track authored game payload that current extractors omit and record verified extraction boundaries.
