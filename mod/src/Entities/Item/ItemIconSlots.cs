using Ardenfall;
using Ardenfall.Item;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item;

public static class ItemIconSlots
{
    public static Color BaseDisplayColor(Ardenfall.ItemCategory? category) => category?.categoryColor ?? Color.white;

    public static Color SlateSpellDisplayColor(Color? spellIconColor) => spellIconColor ?? Color.white;

    public static Color ThrowingPotionDisplayColor(Color? statusEffectIconColor) => statusEffectIconColor ?? Color.white;

    private static Color? SlateSpellIconColor(SlateSpellItemData slate) =>
        slate.spellData?.Get()?.spellData?.Color?.IconColor;

    private static Color? ThrowingPotionIconColor(ThrowingPotionData potion)
    {
        var effects = potion.areaOfEffect?.Get();
        return effects != null && effects.Length > 0 ? effects[0]?.StatusEffect?.Color?.IconColor : null;
    }

    public static Sprite? DisplayIcon(ItemData item)
    {
        if (item is SlateSpellItemData slate)
        {
            var spellIcon = slate.spellData?.Get()?.spellData?.icon;
            if (spellIcon != null) return spellIcon;
        }
        if (item is ThrowingPotionData potion)
        {
            var effects = potion.areaOfEffect?.Get();
            var statusIcon = effects != null && effects.Length > 0 ? effects[0]?.StatusEffect?.statusEffectIcon : null;
            if (statusIcon != null) return statusIcon;
        }
        return item.icon?.Get() ?? item.category?.Get()?.defaultItemIcon;
    }

    public static Color DisplayColor(ItemData item)
    {
        if (item is SlateSpellItemData slate) return SlateSpellDisplayColor(SlateSpellIconColor(slate));
        if (item is ThrowingPotionData potion) return ThrowingPotionDisplayColor(ThrowingPotionIconColor(potion));
        return BaseDisplayColor(item.category?.Get());
    }

    public static Sprite? SecondaryIcon(ItemData item)
    {
        if (item is SlateSpellItemData || item is ThrowingPotionData) return item.icon?.Get();
        return null;
    }

    public static Color? SecondaryColor(ItemData item)
    {
        if (item is SlateSpellItemData slate) return slate.quickslotSecondaryColor?.Get();
        if (item is ThrowingPotionData potion) return potion.quickslotSecondaryColor?.Get();
        return null;
    }
}
