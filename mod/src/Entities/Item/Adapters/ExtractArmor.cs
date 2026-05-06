using System;
using System.Collections.Generic;
using Ardenfall.Item;

namespace ArdenfallArchives.Entities.Item.Adapters;

public static class ExtractArmor
{
    public static Dictionary<string, object?> Extract(ArmorItemData asset) =>
        new(StringComparer.Ordinal)
        {
            ["armorRating"] = asset.armorRating.Get(),
            ["armorDurabilityMax"] = asset.durabilityMax.Get(),
            ["coverageSlot"] = ExtractEquipment.FormatSlots(asset.usableSlots.Get()),
        };
}
