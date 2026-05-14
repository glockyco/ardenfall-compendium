using System;
using System.Linq;
using System.Runtime.CompilerServices;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemVariantClassifierTests
{
    [Theory]
    [InlineData(typeof(MeleeItemData), "melee-weapon")]
    [InlineData(typeof(PrimaryHandItemData), "primary-hand")]
    [InlineData(typeof(HandItemData), "hand-item")]
    [InlineData(typeof(ArmorItemData), "armor")]
    [InlineData(typeof(EquipItemData), "equipment")]
    [InlineData(typeof(ArrowItemData), "arrow")]
    [InlineData(typeof(BowItemData), "bow")]
    [InlineData(typeof(SlateSpellItemData), "slate-spell")]
    [InlineData(typeof(ThrowingPotionData), "throwing-potion")]
    [InlineData(typeof(ThrowingItemData), "throwing-item")]
    [InlineData(typeof(RepairKitItemData), "repair-kit")]
    [InlineData(typeof(PotionRecipeItemData), "potion-recipe")]
    [InlineData(typeof(LockpickItemData), "lockpick")]
    [InlineData(typeof(NoteItemData), "note")]
    [InlineData(typeof(ConsumableItemData), "consumable")]
    [InlineData(typeof(CurrencyItemData), "currency")]
    [InlineData(typeof(ItemData), "basic")]
    public void ClassifiesCurrentlyDescriptorBackedItemTypes(Type itemType, string expectedVariant)
    {
        var item = (ItemData)RuntimeHelpers.GetUninitializedObject(itemType);

        var classified = ItemVariantClassifier.Classify(item);

        Assert.Equal(expectedVariant, classified.VariantId);
    }

    [Theory]
    [InlineData(typeof(ThrowingPotionData), new[] { "equipment", "hand-item", "primary-hand", "throwing-item", "throwing-potion" })]
    [InlineData(typeof(BowItemData), new[] { "equipment", "hand-item", "primary-hand", "bow" })]
    [InlineData(typeof(ArrowItemData), new[] { "equipment", "arrow" })]
    [InlineData(typeof(ConsumableItemData), new[] { "consumable" })]
    public void ReturnsOrderedAdapterLayersForConcreteType(Type itemType, string[] expectedLayers)
    {
        var item = (ItemData)RuntimeHelpers.GetUninitializedObject(itemType);

        var classified = ItemVariantClassifier.Classify(item);

        Assert.Equal(expectedLayers, classified.Layers.Select(layer => layer.VariantId));
    }
}
