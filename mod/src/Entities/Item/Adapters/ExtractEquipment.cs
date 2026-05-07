using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractEquipment
{
    public static Dictionary<string, object?> Extract(EquipItemData asset)
    {
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["equipSlot"] = FormatSlots(asset.usableSlots.Get()),
        };
    }

    internal static string FormatSlots(IReadOnlyCollection<ItemSlotType>? slots) =>
        slots == null || slots.Count == 0 ? "" : string.Join(",", slots.Select(slot => slot.ToString()));
}
