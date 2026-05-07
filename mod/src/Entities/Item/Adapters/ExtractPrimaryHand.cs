using System;
using System.Collections.Generic;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractPrimaryHand
{
    public static Dictionary<string, object?> Extract(PrimaryHandItemData asset) =>
        new(StringComparer.Ordinal)
        {
            ["twoHanded"] = asset.twoHanded.Get(),
        };
}
