using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Walker;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed class ItemCategoryExtractor : WalkerBase<ItemCategorySnapshotRow>
{
    private readonly IItemCategoryAssetSource _source;
    private readonly ItemIconAssetPlan? _assetPlan;

    public ItemCategoryExtractor()
        : this(new BuiltLookupTableItemCategoryAssetSource(), assetPlan: null)
    {
    }

    public ItemCategoryExtractor(IItemCategoryAssetSource source, ItemIconAssetPlan? assetPlan = null)
    {
        _source = source;
        _assetPlan = assetPlan;
    }

    public override IEnumerable<ItemCategorySnapshotRow> Walk()
    {
        foreach (var asset in _source.EnumerateItemCategories())
        {
            var guid = asset.Guid;
            if (string.IsNullOrWhiteSpace(guid))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"ItemCategory asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                });
                continue;
            }

            var iconRef = ResolveNullableAsset(asset.Icon, "iconRef", guid, "ItemCategory.icon");
            var defaultItemIconRef = ResolveNullableAsset(
                asset.DefaultItemIcon,
                "defaultItemIconRef",
                guid,
                "ItemCategory.defaultItemIcon");

            if (_assetPlan != null)
            {
                CaptureSlot(guid, "iconRef", asset.Icon);
                CaptureSlot(guid, "defaultItemIconRef", asset.DefaultItemIcon);
            }

            yield return new ItemCategorySnapshotRow
            {
                Id = guid,
                Fields = new ItemCategorySnapshot(
                    Id: guid,
                    CategoryName: NullIfEmpty(asset.CategoryName) ?? NullIfEmpty(asset.AssetName) ?? guid,
                    IconRef: iconRef,
                    DefaultItemIconRef: defaultItemIconRef,
                    CategoryColor: asset.CategoryColor,
                    ShowInAllCategory: asset.ShowInAllCategory,
                    Columns: asset.Columns.Select(column => ToSnapshot(column, guid)).ToList()),
            };
        }

        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    private SnapshotRef? ResolveNullableAsset(UnityObject? value, string field, string entityRowId, string source) =>
        value == null ? null : Refs.ResolveAsset(value, field, entityRowId, MissingPolicy.Diagnostic, source);

    private void CaptureSlot(string rowId, string slot, UnityObject? value)
    {
        if (_assetPlan != null && value is Sprite sprite)
        {
            _assetPlan.Slots.Add(new ItemIconAssetSlot("item-category", rowId, slot, sprite, "item-category"));
        }
    }

    private ItemCategoryColumnSnapshot ToSnapshot(ItemCategoryColumnAsset column, string categoryId) => new(
        Label: NullIfEmpty(column.Label),
        IconRef: ResolveNullableAsset(column.Icon, "columns.iconRef", categoryId, "ItemCategory.columns.icon"),
        PreferedWidth: column.PreferedWidth,
        FlexibleWidth: column.FlexibleWidth,
        IsItemName: column.IsItemName,
        IsItemIconAndCategory: column.IsItemIconAndCategory,
        IsItemValue: column.IsItemValue,
        IsAffectedBySkillRequirement: column.IsAffectedBySkillRequirement,
        IsAffectedByBrokenDurability: column.IsAffectedByBrokenDurability,
        AffectingRedColor: column.AffectingRedColor,
        AffectingIconsAfter: column.AffectingIconsAfter,
        HideIfNegativeOne: column.HideIfNegativeOne,
        Alignment: column.Alignment,
        ItemDataField: NullIfEmpty(column.ItemDataField),
        ItemFunctionField: NullIfEmpty(column.ItemFunctionField));

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
