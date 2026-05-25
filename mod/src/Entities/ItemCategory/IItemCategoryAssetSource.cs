using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using Ardenfall.Item;
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
    private readonly Func<IEnumerable<ItemData>> _itemAssets;
    private readonly Func<ItemData, ArdenfallCategory?> _itemCategory;
    private readonly Func<ArdenfallCategory, IReadOnlyList<ItemCategoryColumnAsset>> _columns;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string?> _lookupGuid;

    public BuiltLookupTableItemCategoryAssetSource()
        : this(
            lookupCategories: () => BuiltLookupTable.GetAssetsOfType<ArdenfallCategory>(),
            itemAssets: () => BuiltLookupTable.GetAssetsOfType<ItemData>(),
            itemCategory: item => item.category?.Get(),
            columns: Columns,
            isUnityNull: IsUnityNull,
            lookupGuid: LookupGuid)
    {
    }

    public BuiltLookupTableItemCategoryAssetSource(
        Func<IEnumerable<ArdenfallCategory>> lookupCategories,
        Func<IEnumerable<ItemData>> itemAssets,
        Func<ItemData, ArdenfallCategory?> itemCategory,
        Func<ArdenfallCategory, IReadOnlyList<ItemCategoryColumnAsset>> columns,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string?>? lookupGuid = null)
    {
        _lookupCategories = lookupCategories;
        _itemAssets = itemAssets;
        _itemCategory = itemCategory;
        _columns = columns;
        _isUnityNull = isUnityNull;
        _lookupGuid = lookupGuid ?? LookupGuid;
    }

    public IEnumerable<ItemCategoryAsset> EnumerateItemCategories()
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var asset in _lookupCategories())
        {
            if (_isUnityNull(asset)) continue;
            var snapshot = ToAsset(asset);
            if (!string.IsNullOrWhiteSpace(snapshot.Guid) && !seen.Add(snapshot.Guid)) continue;
            yield return snapshot;
        }

        foreach (var asset in EnumerateItemCategoriesFromItems())
        {
            if (_isUnityNull(asset)) continue;
            var snapshot = ToAsset(asset);
            if (!string.IsNullOrWhiteSpace(snapshot.Guid) && !seen.Add(snapshot.Guid)) continue;
            yield return snapshot;
        }
    }

    private IEnumerable<ArdenfallCategory> EnumerateItemCategoriesFromItems()
    {
        foreach (var item in _itemAssets())
        {
            if (_isUnityNull(item)) continue;
            var category = _itemCategory(item);
            if (!_isUnityNull(category)) yield return category!;
        }
    }

    private ItemCategoryAsset ToAsset(ArdenfallCategory asset) => new(
        Guid: _lookupGuid(asset),
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
