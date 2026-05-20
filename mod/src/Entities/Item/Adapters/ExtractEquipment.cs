using System;
using System.Collections.Generic;
using System.Linq;
using ArdenfallStatType = Ardenfall.StatType;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractEquipment
{
    public static Dictionary<string, object?> Extract(EquipItemData asset)
    {
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["equipSlot"] = FormatSlots(asset.usableSlots.Get()),
            ["minimumSkill"] = asset.minimumSkill.Get(),
            ["statType"] = StatTypeLabel(asset.statType.Get()),
        };
    }

    internal static string FormatSlots(IReadOnlyCollection<ItemSlotType>? slots) =>
        slots == null || slots.Count == 0 ? "" : string.Join(",", slots.Select(slot => slot.ToString()));

    public static string? StatTypeLabel(ArdenfallStatType? statType)
    {
        if (ReferenceEquals(statType, null)) return null;
        if (!string.IsNullOrWhiteSpace(statType.statName)) return statType.statName;
        return string.IsNullOrWhiteSpace(statType.id) ? null : statType.id;
    }

}
