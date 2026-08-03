using ArdenfallCompendium.Assets;
using System.Runtime.CompilerServices;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item;
using UnityEngine;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemIconSlotTests
{
    [Fact]
    public void BaseItemColorUsesCategoryColorOrWhite()
    {
        var category = (ItemCategory)RuntimeHelpers.GetUninitializedObject(typeof(ItemCategory));
        category.categoryColor = new Color(0.2f, 0.3f, 0.4f, 1f);
        var color = ItemIconSlots.BaseDisplayColor(category);
        Assert.Equal(0.2f, color.r);
        Assert.Equal(0.3f, color.g);
        Assert.Equal(0.4f, color.b);
        Assert.Equal(1f, color.a);

        var fallback = ItemIconSlots.BaseDisplayColor(null);
        Assert.Equal(Color.white, fallback);
    }

    [Fact]
    public void SlateSpellColorUsesSpellIconColorOrWhite()
    {
        Assert.Equal(Color.white, ItemIconSlots.SlateSpellDisplayColor(null));
        var iconColor = new Color(0.2f, 0.4f, 1f, 1f);
        Assert.Equal(iconColor, ItemIconSlots.SlateSpellDisplayColor(iconColor));
    }

    [Fact]
    public void ThrowingPotionColorUsesStatusEffectIconColorOrWhite()
    {
        Assert.Equal(Color.white, ItemIconSlots.ThrowingPotionDisplayColor(null));
        var iconColor = new Color(0.1f, 0.8f, 0.2f, 1f);
        Assert.Equal(iconColor, ItemIconSlots.ThrowingPotionDisplayColor(iconColor));
    }

    [Fact]
    public void CaptureItemAddsColorMetadataEvenWithoutIconSlots()
    {
        var item = (ItemData)RuntimeHelpers.GetUninitializedObject(typeof(ItemData));
        var plan = new IconAssetPlan();

        IconAssetPlanner.CaptureItem(plan, item, "fixture-item");

        Assert.Empty(plan.Slots);
        Assert.Empty(plan.Manifest.Assets);
        var metadata = Assert.Single(plan.Manifest.ItemIconMetadata);
        Assert.Equal("item", metadata.EntityId);
        Assert.Equal("fixture-item", metadata.RowId);
        Assert.Equal(1f, metadata.DisplayIconColor.R);
        Assert.Null(metadata.SecondaryIconColor);
    }
}
