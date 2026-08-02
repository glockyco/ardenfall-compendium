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
        : this(new LoadedItemCategoryAssetSource(), assetPlan: null)
    {
    }

    public ItemCategoryExtractor(IItemCategoryAssetSource source, ItemIconAssetPlan? assetPlan = null)
    {
        _source = source;
        _assetPlan = assetPlan;
    }

    public override IEnumerable<ItemCategorySnapshotRow> Walk()
    {
        var seenNames = new HashSet<string>(System.StringComparer.Ordinal);
        foreach (var asset in _source.EnumerateItemCategories())
        {
            if (asset == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "itemCategoryAssetMissing",
                    Field = "id",
                    Message = "ItemCategory asset source yielded a null row",
                });
                continue;
            }

            var assetName = asset.AssetName ?? "";
            if (!NamedAssetIdentity.TryCreate("item-category", assetName, out var id))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "namedAssetNameMissing",
                    Field = "id",
                    Message = $"ItemCategory asset has empty or whitespace name '{assetName}'",
                });
                continue;
            }
            if (!seenNames.Add(assetName))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "namedAssetNameDuplicate",
                    Field = "id",
                    Message = $"ItemCategory asset name '{assetName}' is duplicated",
                });
                continue;
            }

            var iconRef = ResolveNullableAsset(asset.Icon, "iconRef", id, "ItemCategory.icon");
            var defaultItemIconRef = ResolveNullableAsset(
                asset.DefaultItemIcon,
                "defaultItemIconRef",
                id,
                "ItemCategory.defaultItemIcon");

            if (_assetPlan != null)
            {
                CaptureSlot(id, "iconRef", asset.Icon);
                CaptureSlot(id, "defaultItemIconRef", asset.DefaultItemIcon);
            }

            var columns = asset.Columns;
            var columnSnapshots = new List<ItemCategoryColumnSnapshot>();
            if (columns == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "itemCategoryColumnsMalformed",
                    Field = "columns",
                    Message = $"ItemCategory '{id}' has null columns data",
                });
            }
            else
            {
                for (var index = 0; index < columns.Count; index++)
                {
                    var column = columns[index];
                    if (column == null)
                    {
                        Diagnostics.Add(new Diagnostic
                        {
                            Severity = "diagnostic",
                            Code = "itemCategoryColumnMalformed",
                            Field = $"columns[{index}]",
                            Message = $"ItemCategory '{id}' has null column data at index {index}",
                        });
                        continue;
                    }
                    columnSnapshots.Add(ToSnapshot(column, id));
                }
            }

            yield return new ItemCategorySnapshotRow
            {
                Id = id,
                Fields = new ItemCategorySnapshot(
                    Id: id,
                    CategoryName: NullIfEmpty(asset.CategoryName) ?? NullIfEmpty(asset.AssetName) ?? id,
                    IconRef: iconRef,
                    DefaultItemIconRef: defaultItemIconRef,
                    CategoryColor: asset.CategoryColor,
                    ShowInAllCategory: asset.ShowInAllCategory,
                    Columns: columnSnapshots),
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
