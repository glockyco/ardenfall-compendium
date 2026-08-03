using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed record ItemCategoryColumnAsset(
    string? Label,
    SnapshotRef? IconRef,
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
    SnapshotRef? IconRef,
    SnapshotRef? DefaultItemIconRef,
    AssetColorSnapshot CategoryColor,
    bool ShowInAllCategory,
    IReadOnlyList<ItemCategoryColumnAsset>? Columns);

public interface IItemCategoryAssetSource
{
    IEnumerable<ItemCategoryAsset> EnumerateItemCategories();
}
