using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractArrow
{
    public static ItemAdapterResult Extract(ArrowItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["damage"] = asset.damage.Get(),
            ["spawnVisualOnHitStatic"] = asset.spawnVisualOnHitStatic.Get(),
            ["spawnVisualOnHitCharacter"] = asset.spawnVisualOnHitCharacter.Get(),
            ["respawnItemPickupChance"] = asset.respawnItemPickupChance.Get(),
            ["addItemToInventoryChance"] = asset.addItemToInventoryChance.Get(),
            ["projectileSettingsJson"] = ItemAdapterHelpers.SnapshotProjectileSettings(asset.projectileSettings.Get()),
            ["projectileRef"] = ItemAdapterHelpers.ResolveOptionalAsset(refs, asset.projectilePrefab.Get(), "projectileRef", rowId, "ArrowItemData.projectilePrefab"),
        };
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal)
        {
            ["damage"] = ProvenanceCapture.ForParameter<float>("damage.Get()", asset.damage.IsSet, inherited: !asset.damage.IsSet),
            ["spawnVisualOnHitStatic"] = ProvenanceCapture.ForParameter<bool>("spawnVisualOnHitStatic.Get()", asset.spawnVisualOnHitStatic.IsSet, inherited: !asset.spawnVisualOnHitStatic.IsSet),
            ["spawnVisualOnHitCharacter"] = ProvenanceCapture.ForParameter<bool>("spawnVisualOnHitCharacter.Get()", asset.spawnVisualOnHitCharacter.IsSet, inherited: !asset.spawnVisualOnHitCharacter.IsSet),
            ["respawnItemPickupChance"] = ProvenanceCapture.ForParameter<float>("respawnItemPickupChance.Get()", asset.respawnItemPickupChance.IsSet, inherited: !asset.respawnItemPickupChance.IsSet),
            ["addItemToInventoryChance"] = ProvenanceCapture.ForParameter<float>("addItemToInventoryChance.Get()", asset.addItemToInventoryChance.IsSet, inherited: !asset.addItemToInventoryChance.IsSet),
            ["projectileSettingsJson"] = ProvenanceCapture.ForParameter<ProjectileSettings>("projectileSettings.Get()", asset.projectileSettings.IsSet, inherited: !asset.projectileSettings.IsSet),
            ["projectileRef"] = ProvenanceCapture.ForParameter<object>("projectilePrefab.Get()", asset.projectilePrefab.IsSet, inherited: !asset.projectilePrefab.IsSet),
        };
        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs), ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }
}
