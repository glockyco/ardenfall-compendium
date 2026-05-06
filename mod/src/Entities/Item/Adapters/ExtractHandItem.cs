using System;
using System.Collections.Generic;
using Ardenfall.Item;

namespace ArdenfallArchives.Entities.Item.Adapters;

public static class ExtractHandItem
{
    public static Dictionary<string, object?> Extract(HandItemData asset) =>
        new(StringComparer.Ordinal)
        {
            ["animationSpeedMultiplier"] = asset.animationSpeedMultiplier.Get(),
        };
}
