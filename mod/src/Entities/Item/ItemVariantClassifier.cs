using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item.Adapters;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item;

public sealed record ItemVariantLayer(string VariantId, Func<ItemData, RefResolver, string, ItemAdapterResult> Extract);

public sealed record ClassifiedItemVariant(string VariantId, IReadOnlyList<ItemVariantLayer> Layers);

public static class ItemVariantClassifier
{
    private static readonly ItemVariantLayer EquipmentLayer = new("equipment", ExtractEquipmentLayer);
    private static readonly ItemVariantLayer HandItemLayer = new("hand-item", ExtractHandItemLayer);
    private static readonly ItemVariantLayer PrimaryHandLayer = new("primary-hand", ExtractPrimaryHandLayer);
    private static readonly ItemVariantLayer MeleeLayer = new("melee-weapon", ExtractMeleeLayer);
    private static readonly ItemVariantLayer ArmorLayer = new("armor", ExtractArmorLayer);
    private static readonly ItemVariantLayer ArrowLayer = new("arrow", ExtractArrowLayer);
    private static readonly ItemVariantLayer BowLayer = new("bow", ExtractBowLayer);
    private static readonly ItemVariantLayer SlateSpellLayer = new("slate-spell", ExtractSlateSpellLayer);
    private static readonly ItemVariantLayer ThrowingItemLayer = new("throwing-item", ExtractThrowingItemLayer);
    private static readonly ItemVariantLayer ThrowingPotionLayer = new("throwing-potion", ExtractThrowingPotionLayer);
    private static readonly ItemVariantLayer RepairKitLayer = new("repair-kit", ExtractRepairKitLayer);
    private static readonly ItemVariantLayer PotionRecipeLayer = new("potion-recipe", ExtractPotionRecipeLayer);
    private static readonly ItemVariantLayer LockpickLayer = new("lockpick", ExtractLockpickLayer);
    private static readonly ItemVariantLayer NoteLayer = new("note", ExtractNoteLayer);
    private static readonly ItemVariantLayer ConsumableLayer = new("consumable", ExtractConsumableLayer);

    private static readonly ItemVariantLayer[] ThrowingPotionLayers = [EquipmentLayer, HandItemLayer, PrimaryHandLayer, ThrowingItemLayer, ThrowingPotionLayer];
    private static readonly ItemVariantLayer[] ThrowingItemLayers = [EquipmentLayer, HandItemLayer, PrimaryHandLayer, ThrowingItemLayer];
    private static readonly ItemVariantLayer[] SlateSpellLayers = [EquipmentLayer, HandItemLayer, PrimaryHandLayer, SlateSpellLayer];
    private static readonly ItemVariantLayer[] BowLayers = [EquipmentLayer, HandItemLayer, PrimaryHandLayer, BowLayer];
    private static readonly ItemVariantLayer[] ArrowLayers = [EquipmentLayer, ArrowLayer];
    private static readonly ItemVariantLayer[] MeleeLayers = [EquipmentLayer, HandItemLayer, PrimaryHandLayer, MeleeLayer];
    private static readonly ItemVariantLayer[] PrimaryHandLayers = [EquipmentLayer, HandItemLayer, PrimaryHandLayer];
    private static readonly ItemVariantLayer[] HandItemLayers = [EquipmentLayer, HandItemLayer];
    private static readonly ItemVariantLayer[] ArmorLayers = [EquipmentLayer, ArmorLayer];
    private static readonly ItemVariantLayer[] EquipmentLayers = [EquipmentLayer];
    private static readonly ItemVariantLayer[] RepairKitLayers = [RepairKitLayer];
    private static readonly ItemVariantLayer[] PotionRecipeLayers = [PotionRecipeLayer];
    private static readonly ItemVariantLayer[] LockpickLayers = [LockpickLayer];
    private static readonly ItemVariantLayer[] CurrencyLayers = [];
    private static readonly ItemVariantLayer[] NoteLayers = [NoteLayer];
    private static readonly ItemVariantLayer[] ConsumableLayers = [ConsumableLayer];
    private static readonly ItemVariantLayer[] BasicLayers = [];
    private static readonly ItemVariantLayer[] UnsupportedLayers = [];

    public static ClassifiedItemVariant Classify(ItemData asset) =>
        asset switch
        {
            ThrowingPotionData => new ClassifiedItemVariant("throwing-potion", ThrowingPotionLayers),
            ThrowingItemData => new ClassifiedItemVariant("throwing-item", ThrowingItemLayers),
            SlateSpellItemData => new ClassifiedItemVariant("slate-spell", SlateSpellLayers),
            BowItemData => new ClassifiedItemVariant("bow", BowLayers),
            ArrowItemData => new ClassifiedItemVariant("arrow", ArrowLayers),
            MeleeItemData => new ClassifiedItemVariant("melee-weapon", MeleeLayers),
            PrimaryHandItemData => new ClassifiedItemVariant("primary-hand", PrimaryHandLayers),
            HandItemData => new ClassifiedItemVariant("hand-item", HandItemLayers),
            ArmorItemData => new ClassifiedItemVariant("armor", ArmorLayers),
            EquipItemData => new ClassifiedItemVariant("equipment", EquipmentLayers),
            RepairKitItemData => new ClassifiedItemVariant("repair-kit", RepairKitLayers),
            PotionRecipeItemData => new ClassifiedItemVariant("potion-recipe", PotionRecipeLayers),
            LockpickItemData => new ClassifiedItemVariant("lockpick", LockpickLayers),
            CurrencyItemData => new ClassifiedItemVariant("currency", CurrencyLayers),
            NoteItemData => new ClassifiedItemVariant("note", NoteLayers),
            ConsumableItemData => new ClassifiedItemVariant("consumable", ConsumableLayers),
            _ when asset.GetType() == typeof(ItemData) => new ClassifiedItemVariant("basic", BasicLayers),
            _ => new ClassifiedItemVariant("unsupported", UnsupportedLayers),
        };

    private static ItemAdapterResult FromFields(Dictionary<string, object?> fields) =>
        new(fields, new Dictionary<string, Provenance>(StringComparer.Ordinal), new List<Diagnostic>());

    private static ItemAdapterResult ExtractEquipmentLayer(ItemData asset, RefResolver refs, string rowId) =>
        FromFields(ExtractEquipment.Extract((EquipItemData)asset));

    private static ItemAdapterResult ExtractHandItemLayer(ItemData asset, RefResolver refs, string rowId) =>
        FromFields(ExtractHandItem.Extract((HandItemData)asset));

    private static ItemAdapterResult ExtractPrimaryHandLayer(ItemData asset, RefResolver refs, string rowId) =>
        FromFields(ExtractPrimaryHand.Extract((PrimaryHandItemData)asset));

    private static ItemAdapterResult ExtractMeleeLayer(ItemData asset, RefResolver refs, string rowId) =>
        FromFields(ExtractMelee.Extract((MeleeItemData)asset));

    private static ItemAdapterResult ExtractArmorLayer(ItemData asset, RefResolver refs, string rowId) =>
        FromFields(ExtractArmor.Extract((ArmorItemData)asset));

    private static ItemAdapterResult ExtractArrowLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractArrow.Extract((ArrowItemData)asset, refs, rowId);

    private static ItemAdapterResult ExtractBowLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractBow.Extract((BowItemData)asset, refs, rowId);

    private static ItemAdapterResult ExtractSlateSpellLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractSlateSpell.Extract((SlateSpellItemData)asset, refs, rowId);

    private static ItemAdapterResult ExtractThrowingItemLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractThrowingItem.Extract((ThrowingItemData)asset, refs, rowId);

    private static ItemAdapterResult ExtractThrowingPotionLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractThrowingPotion.Extract((ThrowingPotionData)asset, refs, rowId);

    private static ItemAdapterResult ExtractRepairKitLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractRepairKit.Extract((RepairKitItemData)asset, refs);

    private static ItemAdapterResult ExtractPotionRecipeLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractPotionRecipe.Extract((PotionRecipeItemData)asset, refs, rowId);

    private static ItemAdapterResult ExtractLockpickLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractLockpick.Extract((LockpickItemData)asset, refs);

    private static ItemAdapterResult ExtractNoteLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractNote.Extract((NoteItemData)asset, refs, rowId);

    private static ItemAdapterResult ExtractConsumableLayer(ItemData asset, RefResolver refs, string rowId) =>
        ExtractConsumable.Extract((ConsumableItemData)asset, refs, rowId);
}
