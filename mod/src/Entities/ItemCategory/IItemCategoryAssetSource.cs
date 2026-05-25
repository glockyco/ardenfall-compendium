using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
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
    private readonly Func<IEnumerable<ArdenfallCategory>> _lookupCategories;
    private readonly Func<ArdenfallCategory, IReadOnlyList<ItemCategoryColumnAsset>> _columns;
    private readonly Func<UnityObject?, bool> _isUnityNull;

    public BuiltLookupTableItemCategoryAssetSource()
        : this(
            lookupCategories: () => BuiltLookupTable.GetAssetsOfType<ArdenfallCategory>(),
            columns: Columns,
            isUnityNull: IsUnityNull)
    {
    }

    public BuiltLookupTableItemCategoryAssetSource(
        Func<IEnumerable<ArdenfallCategory>> lookupCategories,
        Func<UnityObject?, bool> isUnityNull,
        Func<ArdenfallCategory, IReadOnlyList<ItemCategoryColumnAsset>>? columns = null)
    {
        _lookupCategories = lookupCategories;
        _columns = columns ?? Columns;
        _isUnityNull = isUnityNull;
    }

    public IEnumerable<ItemCategoryAsset> EnumerateItemCategories()
    {
        foreach (var asset in _lookupCategories())
        {
            if (_isUnityNull(asset)) continue;
            yield return ToAsset(asset);
        }
    }

    private ItemCategoryAsset ToAsset(ArdenfallCategory asset) => new(
        Guid: LookupGuid(asset),
        AssetName: SafeName(asset),
        CategoryName: asset.categoryName,
        Icon: asset.icon,
        DefaultItemIcon: asset.defaultItemIcon,
        CategoryColor: AssetColorSnapshot.FromColor(asset.categoryColor),
        ShowInAllCategory: asset.showInAllCategory,
        Columns: _columns(asset));

    private static IReadOnlyList<ItemCategoryColumnAsset> Columns(ArdenfallCategory asset) =>
        asset.columns?.Where(column => column != null).Select(ToColumnAsset).ToList()
            ?? new List<ItemCategoryColumnAsset>();

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch
        {
            return "";
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch
        {
            return false;
        }
    }

    private static string? LookupGuid(UnityObject asset)
    {
        try
        {
            return BuiltLookupTable.Instance != null ? BuiltLookupTable.Instance.GetGuid(asset) : null;
        }
        catch
        {
            return null;
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
