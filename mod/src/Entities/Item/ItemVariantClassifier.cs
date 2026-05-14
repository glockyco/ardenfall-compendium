using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item;

public sealed record ClassifiedItemVariant(string VariantId);

public static class ItemVariantClassifier
{
    public static ClassifiedItemVariant Classify(ItemData asset)
    {
        var variantId = asset switch
        {
            ThrowingPotionData => "throwing-potion",
            ThrowingItemData => "throwing-item",
            SlateSpellItemData => "slate-spell",
            BowItemData => "bow",
            ArrowItemData => "arrow",
            MeleeItemData => "melee-weapon",
            PrimaryHandItemData => "primary-hand",
            HandItemData => "hand-item",
            ArmorItemData => "armor",
            EquipItemData => "equipment",
            RepairKitItemData => "repair-kit",
            PotionRecipeItemData => "potion-recipe",
            LockpickItemData => "lockpick",
            CurrencyItemData => "currency",
            NoteItemData => "note",
            ConsumableItemData => "consumable",
            _ when asset.GetType() == typeof(ItemData) => "basic",
            _ => "unsupported",
        };

        return new ClassifiedItemVariant(variantId);
    }
}
