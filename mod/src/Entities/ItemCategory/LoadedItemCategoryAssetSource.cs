using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Walker;
using ArdenfallCategory = Ardenfall.ItemCategory;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed class LoadedItemCategoryAssetSource : IItemCategoryAssetSource, IIconAssetPlanSink
{
    private ItemIconAssetPlan? _assetPlan;
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

    public void AttachAssetPlan(ItemIconAssetPlan? assetPlan) => _assetPlan = assetPlan;

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
                     .Select(ToAsset)
                     .OrderBy(asset => asset.AssetName, StringComparer.Ordinal))
        {
            yield return asset;
        }
    }

    private ItemCategoryAsset ToAsset(ArdenfallCategory asset)
    {
        var assetName = _assetName(asset);
        if (_assetPlan != null && NamedAssetIdentity.TryCreate("item-category", assetName, out var id))
        {
            CaptureSlot(id, "iconRef", asset.icon);
            CaptureSlot(id, "defaultItemIconRef", asset.defaultItemIcon);
        }
        return new ItemCategoryAsset(
            Guid: null,
            AssetName: _assetName(asset),
            CategoryName: asset.categoryName,
            IconRef: EngineIconRef(asset.icon, "ItemCategory.icon"),
            DefaultItemIconRef: EngineIconRef(asset.defaultItemIcon, "ItemCategory.defaultItemIcon"),
            CategoryColor: AssetColorSnapshot.FromColor(asset.categoryColor),
            ShowInAllCategory: asset.showInAllCategory,
            Columns: _columns(asset));
    }

    private void CaptureSlot(string rowId, string slot, UnityObject? value)
    {
        if (_assetPlan != null && value is UnityEngine.Sprite sprite)
        {
            _assetPlan.Slots.Add(new ItemIconAssetSlot("item-category", rowId, slot, sprite, "item-category"));
        }
    }

    private static IReadOnlyList<ItemCategoryColumnAsset> Columns(ArdenfallCategory asset) =>
        asset.columns?.Where(column => column != null).Select(ToColumnAsset).ToList()
            ?? new List<ItemCategoryColumnAsset>();

    private static ItemCategoryColumnAsset ToColumnAsset(ArdenfallCategory.CategoryColumn column) => new(
        Label: column.label,
        IconRef: EngineIconRef(column.icon, "ItemCategory.columns.icon"),
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

    private static SnapshotRef? EngineIconRef(UnityObject? value, string source) =>
        value == null ? null : SnapshotRef.Missing("engineResource", source);

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("ItemCategory lookup failed for field 'name'.", exception);
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("ItemCategory lookup failed for field 'asset'.", exception);
        }
    }

    private static bool IsAuthoredAsset(UnityObject asset)
    {
        try
        {
            return (asset.hideFlags & UnityEngine.HideFlags.DontSave) == 0;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("ItemCategory lookup failed for field 'hideFlags'.", exception);
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
