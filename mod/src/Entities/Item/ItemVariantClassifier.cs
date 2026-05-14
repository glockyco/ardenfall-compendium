using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item;

public sealed record ClassifiedItemVariant(string VariantId);

public static class ItemVariantClassifier
{
    public static ClassifiedItemVariant Classify(ItemData asset)
    {
        var variantId = asset switch
        {
            MeleeItemData => "melee-weapon",
            PrimaryHandItemData => "primary-hand",
            HandItemData => "hand-item",
            ArmorItemData => "armor",
            EquipItemData => "equipment",
            CurrencyItemData => "currency",
            _ when asset.GetType() == typeof(ItemData) => "basic",
            _ => "unsupported",
        };

        return new ClassifiedItemVariant(variantId);
    }
}
