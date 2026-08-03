using System;
using System.Collections.Generic;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractMelee
{
    public static ItemAdapterResult Extract(MeleeItemData asset)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["damage"] = asset.damage.Get(),
            ["criticalHitChance"] = asset.criticalHitChance.Get(),
            ["meleeDurabilityMax"] = asset.durabilityMax.Get(),
            ["canBlock"] = asset.canBlock.Get(),
        };
        var presentationOnlyFields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["hardAttackDamMult"] = asset.hardAttackDamMult.Get(),
        };
        return new ItemAdapterResult(
            fields,
            new Dictionary<string, Provenance>(StringComparer.Ordinal),
            new List<Diagnostic>(),
            presentationOnlyFields);
    }
}
