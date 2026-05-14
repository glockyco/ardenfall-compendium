using System;
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
}
