using System;
using System.Collections.Generic;
using Ardenfall.Item;

namespace ArdenfallArchives.Entities.Item.Adapters;

public static class ExtractMelee
{
    public static Dictionary<string, object?> Extract(MeleeItemData asset) =>
        new(StringComparer.Ordinal)
        {
            ["damage"] = asset.damage.Get(),
            ["criticalHitChance"] = asset.criticalHitChance.Get(),
            ["meleeDurabilityMax"] = asset.durabilityMax.Get(),
            ["canBlock"] = asset.canBlock.Get(),
        };
}
