using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractThrowingItem
{
    public static ItemAdapterResult Extract(ThrowingItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["itemTypeTooltip"] = asset.itemTypeTooltip.Get(),
            ["missileRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, asset.missilePrefab.Get(), "missileRef", rowId, "ThrowingItemData.missilePrefab"),
            ["missileRotationJson"] = ItemAdapterHelpers.SnapshotVector3(asset.missileRotation.Get()),
            ["damage"] = asset.damage.Get(),
            ["pierceArmor"] = asset.pierceArmor.Get(),
            ["bleedMultiplier"] = asset.bleedMultiplier.Get(),
            ["damageFalloffDistance"] = asset.damageFalloffDistance.Get(),
            ["damageFalloff"] = asset.damageFalloff.Get(),
            ["critChance"] = asset.critChance.Get(),
            ["stunChance"] = asset.stunChance.Get(),
            ["bleedChance"] = asset.bleedChance.Get(),
            ["critDamageMult"] = asset.critDamageMult.Get(),
            ["quickslotCooldownTime"] = asset.quickslotCooldownTime.Get(),
            ["bleedStatusEffectJson"] = ItemAdapterHelpers.SnapshotLeveledStatusEffect(asset.bleedStatusEffect.Get(), refs, rowId),
            ["stealthHitMultiplier"] = asset.stealthHitMultiplier.Get(),
            ["spawnVisualOnHitStatic"] = asset.spawnVisualOnHitStatic.Get(),
            ["spawnVisualOnHitCharacter"] = asset.spawnVisualOnHitCharacter.Get(),
            ["respawnItemPickupChance"] = asset.respawnItemPickupChance.Get(),
            ["addItemToInventoryChance"] = asset.addItemToInventoryChance.Get(),
            ["missileSettingsJson"] = ItemAdapterHelpers.SnapshotProjectileSettings(asset.missileSettings.Get()),
        };
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal)
        {
            ["itemTypeTooltip"] = ProvenanceCapture.ForParameter<string>("itemTypeTooltip.Get()", asset.itemTypeTooltip.IsSet, inherited: !asset.itemTypeTooltip.IsSet),
            ["missileRef"] = ProvenanceCapture.ForParameter<object>("missilePrefab.Get()", asset.missilePrefab.IsSet, inherited: !asset.missilePrefab.IsSet),
            ["missileRotationJson"] = ProvenanceCapture.ForParameter<Vector3>("missileRotation.Get()", asset.missileRotation.IsSet, inherited: !asset.missileRotation.IsSet),
            ["damage"] = ProvenanceCapture.ForParameter<float>("damage.Get()", asset.damage.IsSet, inherited: !asset.damage.IsSet),
            ["pierceArmor"] = ProvenanceCapture.ForParameter<bool>("pierceArmor.Get()", asset.pierceArmor.IsSet, inherited: !asset.pierceArmor.IsSet),
            ["bleedMultiplier"] = ProvenanceCapture.ForParameter<float>("bleedMultiplier.Get()", asset.bleedMultiplier.IsSet, inherited: !asset.bleedMultiplier.IsSet),
            ["damageFalloffDistance"] = ProvenanceCapture.ForParameter<float>("damageFalloffDistance.Get()", asset.damageFalloffDistance.IsSet, inherited: !asset.damageFalloffDistance.IsSet),
            ["damageFalloff"] = ProvenanceCapture.ForParameter<float>("damageFalloff.Get()", asset.damageFalloff.IsSet, inherited: !asset.damageFalloff.IsSet),
            ["critChance"] = ProvenanceCapture.ForParameter<float>("critChance.Get()", asset.critChance.IsSet, inherited: !asset.critChance.IsSet),
            ["stunChance"] = ProvenanceCapture.ForParameter<float>("stunChance.Get()", asset.stunChance.IsSet, inherited: !asset.stunChance.IsSet),
            ["bleedChance"] = ProvenanceCapture.ForParameter<float>("bleedChance.Get()", asset.bleedChance.IsSet, inherited: !asset.bleedChance.IsSet),
            ["critDamageMult"] = ProvenanceCapture.ForParameter<float>("critDamageMult.Get()", asset.critDamageMult.IsSet, inherited: !asset.critDamageMult.IsSet),
            ["quickslotCooldownTime"] = ProvenanceCapture.ForParameter<float>("quickslotCooldownTime.Get()", asset.quickslotCooldownTime.IsSet, inherited: !asset.quickslotCooldownTime.IsSet),
            ["bleedStatusEffectJson"] = ProvenanceCapture.ForParameter<LeveledStatusEffect>("bleedStatusEffect.Get()", asset.bleedStatusEffect.IsSet, inherited: !asset.bleedStatusEffect.IsSet),
            ["stealthHitMultiplier"] = ProvenanceCapture.ForParameter<float>("stealthHitMultiplier.Get()", asset.stealthHitMultiplier.IsSet, inherited: !asset.stealthHitMultiplier.IsSet),
            ["spawnVisualOnHitStatic"] = ProvenanceCapture.ForParameter<bool>("spawnVisualOnHitStatic.Get()", asset.spawnVisualOnHitStatic.IsSet, inherited: !asset.spawnVisualOnHitStatic.IsSet),
            ["spawnVisualOnHitCharacter"] = ProvenanceCapture.ForParameter<bool>("spawnVisualOnHitCharacter.Get()", asset.spawnVisualOnHitCharacter.IsSet, inherited: !asset.spawnVisualOnHitCharacter.IsSet),
            ["respawnItemPickupChance"] = ProvenanceCapture.ForParameter<float>("respawnItemPickupChance.Get()", asset.respawnItemPickupChance.IsSet, inherited: !asset.respawnItemPickupChance.IsSet),
            ["addItemToInventoryChance"] = ProvenanceCapture.ForParameter<float>("addItemToInventoryChance.Get()", asset.addItemToInventoryChance.IsSet, inherited: !asset.addItemToInventoryChance.IsSet),
            ["missileSettingsJson"] = ProvenanceCapture.ForParameter<ProjectileSettings>("missileSettings.Get()", asset.missileSettings.IsSet, inherited: !asset.missileSettings.IsSet),
        };
        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs), ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }
}
