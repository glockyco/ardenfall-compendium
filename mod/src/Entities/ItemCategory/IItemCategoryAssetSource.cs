using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;
using ArdenfallCategory = Ardenfall.ItemCategory;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed record ItemCategoryColumnAsset(
    string? Label,
    UnityObject? Icon,
    float PreferedWidth,
    float FlexibleWidth,
    bool IsItemName,
    bool IsItemIconAndCategory,
    bool IsItemValue,
    bool IsAffectedBySkillRequirement,
    bool IsAffectedByBrokenDurability,
    bool AffectingRedColor,
    bool AffectingIconsAfter,
    bool HideIfNegativeOne,
    string Alignment,
    string? ItemDataField,
    string? ItemFunctionField);

public sealed record ItemCategoryAsset(
    string? Guid,
    string AssetName,
    string? CategoryName,
    UnityObject? Icon,
    UnityObject? DefaultItemIcon,
    AssetColorSnapshot CategoryColor,
    bool ShowInAllCategory,
    IReadOnlyList<ItemCategoryColumnAsset> Columns);

public interface IItemCategoryAssetSource
{
    IEnumerable<ItemCategoryAsset> EnumerateItemCategories();
}

public sealed class BuiltLookupTableItemCategoryAssetSource : IItemCategoryAssetSource
{
    public IEnumerable<ItemCategoryAsset> EnumerateItemCategories()
    {
        var lookup = BuiltLookupTable.Instance;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<ArdenfallCategory>())
        {
            if (asset == null) continue;
            yield return new ItemCategoryAsset(
                Guid: lookup?.GetGuid(asset),
                AssetName: asset.name ?? "",
                CategoryName: asset.categoryName,
                Icon: asset.icon,
                DefaultItemIcon: asset.defaultItemIcon,
                CategoryColor: AssetColorSnapshot.FromColor(asset.categoryColor),
                ShowInAllCategory: asset.showInAllCategory,
                Columns: asset.columns?.Where(column => column != null).Select(ToColumnAsset).ToList()
                    ?? new List<ItemCategoryColumnAsset>());
        }
    }

    private static ItemCategoryColumnAsset ToColumnAsset(ArdenfallCategory.CategoryColumn column) => new(
        Label: column.label,
        Icon: column.icon,
        PreferedWidth: column.preferedWidth,
        FlexibleWidth: column.flexibleWidth,
        IsItemName: column.itemName,
        IsItemIconAndCategory: column.isItemIconAndCategory,
        IsItemValue: column.itemValue,
        IsAffectedBySkillRequirement: column.isAffectedBySkillRequirement,
        IsAffectedByBrokenDurability: column.isAffectedByBrokenDurability,
        AffectingRedColor: column.affectingRedColor,
        AffectingIconsAfter: column.affectingIconsAfter,
        HideIfNegativeOne: column.hideIfNegativeOne,
        Alignment: column.GetType().GetField("alignment")?.GetValue(column)?.ToString() ?? "",
        ItemDataField: NullIfEmpty(column.itemDataField),
        ItemFunctionField: NullIfEmpty(column.itemFunctionField));

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
