using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed class ItemCategoryExtractor : WalkerBase<ItemCategorySnapshotRow>
{
    private readonly IItemCategoryAssetSource _source;
    private readonly IconAssetPlan? _assetPlan;

    public ItemCategoryExtractor()
        : this(new LoadedItemCategoryAssetSource(), assetPlan: null)
    {
    }

    public ItemCategoryExtractor(IItemCategoryAssetSource source, IconAssetPlan? assetPlan = null)
    {
        _source = source;
        _assetPlan = assetPlan;
        if (source is IIconAssetPlanSink sink) sink.AttachAssetPlan(assetPlan);
    }

    public override IEnumerable<ItemCategorySnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateItemCategories(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "itemCategoryAssetMissing",
                Field = "id",
                Message = "ItemCategory asset source yielded a null row",
            },
            asset => CreateIdentity(asset),
            (asset, id) =>
            {
                var iconRef = asset.IconRef;
                var defaultItemIconRef = asset.DefaultItemIconRef;


                var categoryName = NullIfEmpty(asset.CategoryName);
                if (categoryName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "itemCategoryNameMissing",
                        Field = "categoryName",
                        Message = $"ItemCategory '{id}' has empty or whitespace categoryName",
                    });
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
                        columnSnapshots.Add(ToSnapshot(column!, id));
                    }
                }

                return new ItemCategorySnapshotRow
                {
                    Id = id,
                    Fields = new ItemCategorySnapshot(
                        Id: id,
                        CategoryName: categoryName,
                        IconRef: iconRef,
                        DefaultItemIconRef: defaultItemIconRef,
                        CategoryColor: asset.CategoryColor,
                        ShowInAllCategory: asset.ShowInAllCategory,
                        Columns: columnSnapshots),
                };
            });
    }

    private static ExtractorIdentity CreateIdentity(ItemCategoryAsset asset)
    {
        var assetName = asset.AssetName ?? "";
        if (!NamedAssetIdentity.TryCreate("item-category", assetName, out var id))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameMissing",
                Field = "id",
                Message = $"ItemCategory asset has empty or whitespace name '{assetName}'",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private ItemCategoryColumnSnapshot ToSnapshot(ItemCategoryColumnAsset column, string categoryId) => new(
        Label: NullIfEmpty(column.Label),
        IconRef: column.IconRef,
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
