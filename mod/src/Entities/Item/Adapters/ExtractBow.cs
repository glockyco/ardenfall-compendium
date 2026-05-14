using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractBow
{
    public static ItemAdapterResult Extract(BowItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["itemTypeTooltip"] = asset.itemTypeTooltip.Get(),
            ["damage"] = asset.damage.Get(),
            ["bleedMultiplier"] = asset.bleedMultiplier.Get(),
            ["shootStaminaMultiplier"] = asset.shootStaminaMultiplier.Get(),
            ["criticalHitChance"] = asset.criticalHitChance.Get(),
            ["stunChance"] = asset.stunChance.Get(),
            ["bleedChance"] = asset.bleedChance.Get(),
            ["critDamageMult"] = asset.critDamageMult.Get(),
            ["knockbackStrength"] = asset.knockbackStrength.Get(),
            ["stealthHitMultiplier"] = asset.stealthHitMultiplier.Get(),
            ["ammoMassMultiplier"] = asset.ammoMassMultiplier.Get(),
            ["damageFalloffDistance"] = asset.damageFalloffDistance.Get(),
            ["damageFalloff"] = asset.damageFalloff.Get(),
            ["durabilityMax"] = asset.durabilityMax.Get(),
            ["projectileSlot"] = asset.projectileSlot.Get().ToString(),
            ["projectileIconRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, asset.projectileIcon.Get(), "projectileIconRef", rowId, "BowItemData.projectileIcon"),
            ["aimAnimationSpeedMultiplier"] = asset.aimAnimationSpeedMultiplier.Get(),
            ["bleedStatusEffectJson"] = ItemAdapterHelpers.SnapshotLeveledStatusEffect(asset.bleedStatusEffect.Get(), refs, rowId),
        };
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal)
        {
            ["itemTypeTooltip"] = ProvenanceCapture.ForParameter<string>("itemTypeTooltip.Get()", asset.itemTypeTooltip.IsSet, inherited: !asset.itemTypeTooltip.IsSet),
            ["damage"] = ProvenanceCapture.ForParameter<float>("damage.Get()", asset.damage.IsSet, inherited: !asset.damage.IsSet),
            ["bleedMultiplier"] = ProvenanceCapture.ForParameter<float>("bleedMultiplier.Get()", asset.bleedMultiplier.IsSet, inherited: !asset.bleedMultiplier.IsSet),
            ["shootStaminaMultiplier"] = ProvenanceCapture.ForParameter<float>("shootStaminaMultiplier.Get()", asset.shootStaminaMultiplier.IsSet, inherited: !asset.shootStaminaMultiplier.IsSet),
            ["criticalHitChance"] = ProvenanceCapture.ForParameter<float>("criticalHitChance.Get()", asset.criticalHitChance.IsSet, inherited: !asset.criticalHitChance.IsSet),
            ["stunChance"] = ProvenanceCapture.ForParameter<float>("stunChance.Get()", asset.stunChance.IsSet, inherited: !asset.stunChance.IsSet),
            ["bleedChance"] = ProvenanceCapture.ForParameter<float>("bleedChance.Get()", asset.bleedChance.IsSet, inherited: !asset.bleedChance.IsSet),
            ["critDamageMult"] = ProvenanceCapture.ForParameter<float>("critDamageMult.Get()", asset.critDamageMult.IsSet, inherited: !asset.critDamageMult.IsSet),
            ["knockbackStrength"] = ProvenanceCapture.ForParameter<float>("knockbackStrength.Get()", asset.knockbackStrength.IsSet, inherited: !asset.knockbackStrength.IsSet),
            ["stealthHitMultiplier"] = ProvenanceCapture.ForParameter<float>("stealthHitMultiplier.Get()", asset.stealthHitMultiplier.IsSet, inherited: !asset.stealthHitMultiplier.IsSet),
            ["ammoMassMultiplier"] = ProvenanceCapture.ForParameter<float>("ammoMassMultiplier.Get()", asset.ammoMassMultiplier.IsSet, inherited: !asset.ammoMassMultiplier.IsSet),
            ["damageFalloffDistance"] = ProvenanceCapture.ForParameter<float>("damageFalloffDistance.Get()", asset.damageFalloffDistance.IsSet, inherited: !asset.damageFalloffDistance.IsSet),
            ["damageFalloff"] = ProvenanceCapture.ForParameter<float>("damageFalloff.Get()", asset.damageFalloff.IsSet, inherited: !asset.damageFalloff.IsSet),
            ["durabilityMax"] = ProvenanceCapture.ForParameter<int>("durabilityMax.Get()", asset.durabilityMax.IsSet, inherited: !asset.durabilityMax.IsSet),
            ["projectileSlot"] = ProvenanceCapture.ForParameter<ItemSlotType>("projectileSlot.Get()", asset.projectileSlot.IsSet, inherited: !asset.projectileSlot.IsSet),
            ["projectileIconRef"] = ProvenanceCapture.ForParameter<object>("projectileIcon.Get()", asset.projectileIcon.IsSet, inherited: !asset.projectileIcon.IsSet),
            ["aimAnimationSpeedMultiplier"] = ProvenanceCapture.ForParameter<float>("aimAnimationSpeedMultiplier.Get()", asset.aimAnimationSpeedMultiplier.IsSet, inherited: !asset.aimAnimationSpeedMultiplier.IsSet),
            ["bleedStatusEffectJson"] = ProvenanceCapture.ForParameter<LeveledStatusEffect>("bleedStatusEffect.Get()", asset.bleedStatusEffect.IsSet, inherited: !asset.bleedStatusEffect.IsSet),
        };
        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs));
    }
}
