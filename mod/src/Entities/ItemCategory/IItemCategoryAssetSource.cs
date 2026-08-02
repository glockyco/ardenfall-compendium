using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
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
    IReadOnlyList<ItemCategoryColumnAsset>? Columns);

public interface IItemCategoryAssetSource
{
    IEnumerable<ItemCategoryAsset> EnumerateItemCategories();
}

public sealed class LoadedItemCategoryAssetSource : IItemCategoryAssetSource
{
    private readonly Func<IEnumerable<ArdenfallCategory>> _loadedCategories;
    private readonly Func<ArdenfallCategory, IReadOnlyList<ItemCategoryColumnAsset>?> _columns;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;
    private readonly Func<UnityObject, bool> _isAuthoredAsset;

    public LoadedItemCategoryAssetSource()
        : this(
            loadedCategories: () => UnityEngine.Resources.FindObjectsOfTypeAll<ArdenfallCategory>(),
            columns: Columns,
            isUnityNull: IsUnityNull,
            assetName: SafeName,
            isAuthoredAsset: IsAuthoredAsset)
    {
    }

    public LoadedItemCategoryAssetSource(
        Func<IEnumerable<ArdenfallCategory>> loadedCategories,
        Func<UnityObject?, bool> isUnityNull,
        Func<ArdenfallCategory, IReadOnlyList<ItemCategoryColumnAsset>?>? columns = null,
        Func<UnityObject, string>? assetName = null,
        Func<UnityObject, bool>? isAuthoredAsset = null)
    {
        _loadedCategories = loadedCategories;
        _columns = columns ?? Columns;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
        _isAuthoredAsset = isAuthoredAsset ?? IsAuthoredAsset;
    }

    public IEnumerable<ItemCategoryAsset> EnumerateItemCategories()
    {
        var seen = new HashSet<ArdenfallCategory>(UnityObjectReferenceComparer<ArdenfallCategory>.Instance);
        var assets = new List<ArdenfallCategory>();
        foreach (var asset in _loadedCategories())
        {
            if (_isUnityNull(asset) || !_isAuthoredAsset(asset) || !seen.Add(asset)) continue;
            assets.Add(asset);
        }

        foreach (var asset in assets
                     .Select(asset => ToAsset(asset))
                     .OrderBy(asset => asset.AssetName, StringComparer.Ordinal))
        {
            yield return asset;
        }
    }

    private ItemCategoryAsset ToAsset(ArdenfallCategory asset) => new(
        Guid: null,
        AssetName: _assetName(asset),
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

    private static bool IsAuthoredAsset(UnityObject asset)
    {
        try
        {
            return (asset.hideFlags & UnityEngine.HideFlags.DontSave) == 0;
        }
        catch
        {
            return false;
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
