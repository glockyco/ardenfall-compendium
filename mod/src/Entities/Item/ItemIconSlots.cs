using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
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

public sealed record ItemIconAssetSlot(string EntityId, string RowId, string Slot, Sprite Sprite, string OutputSubdir);

public interface IIconAssetPlanSink
{
    void AttachAssetPlan(ItemIconAssetPlan? assetPlan);
}

public sealed class ItemIconAssetPlan
{
    public List<ItemIconAssetSlot> Slots { get; } = new();
    public AssetManifest Manifest { get; } = new();
}

public static class ItemIconAssetPlanner
{
    public static void CaptureItem(ItemIconAssetPlan plan, ItemData item, string rowId)
    {
        CaptureSlot(plan, rowId, "displayIcon", ItemIconSlots.DisplayIcon(item));
        CaptureSlot(plan, rowId, "secondaryIcon", ItemIconSlots.SecondaryIcon(item));
        var secondaryColor = ItemIconSlots.SecondaryColor(item);
        plan.Manifest.ItemIconMetadata.Add(new ItemIconMetadataEntry
        {
            EntityId = "item",
            RowId = rowId,
            DisplayIconColor = AssetColorSnapshot.FromColor(ItemIconSlots.DisplayColor(item)),
            SecondaryIconColor = secondaryColor.HasValue ? AssetColorSnapshot.FromColor(secondaryColor.Value) : null,
        });
    }

    private static void CaptureSlot(ItemIconAssetPlan plan, string rowId, string slot, Sprite? sprite)
    {
        if (sprite != null) plan.Slots.Add(new ItemIconAssetSlot("item", rowId, slot, sprite, "item"));
    }
}

public sealed class ItemAssetManifestWriter
{
    private readonly SpriteAssetExporter _exporter;

    public ItemAssetManifestWriter(SpriteAssetExporter exporter)
    {
        _exporter = exporter;
    }

    public void WriteSlots(string outputDir, ItemIconAssetPlan plan)
    {
        foreach (var slot in plan.Slots)
        {
            var exported = _exporter.WriteSpritePng(slot.Sprite, outputDir, slot.OutputSubdir);
            plan.Manifest.Assets.Add(new AssetManifestEntry
            {
                EntityId = slot.EntityId,
                RowId = slot.RowId,
                Slot = slot.Slot,
                Kind = "image",
                PngHash = exported.PngHash,
                SourcePath = exported.SourcePath,
            });
        }
    }
}
