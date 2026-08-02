using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.ItemCategory;
using UnityEngine;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemCategoryExtractorTests
{
    [Fact]
    public void ExtractsEveryCategoryWithColumns()
    {
        var source = new FakeItemCategoryAssetSource(new[]
        {
            FakeItemCategoryAssetSource.Build(
                guid: "category-weapons",
                name: "Weapons",
                showInAllCategory: true,
                columns: new[]
                {
                    FakeItemCategoryAssetSource.Column("Name", preferedWidth: 1.5f, flexibleWidth: 2.0f, itemName: true),
                }),
            FakeItemCategoryAssetSource.Build(
                guid: "category-consumables",
                name: "Consumables",
                showInAllCategory: false,
                columns: new[]
                {
                    FakeItemCategoryAssetSource.Column("Value", itemValue: true),
                }),
        });
        var extractor = new ItemCategoryExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Equal(2, rows.Count);
        Assert.Equal("category-weapons", rows[0].Id);
        Assert.Equal("Weapons", rows[0].Fields.CategoryName);
        Assert.True(rows[0].Fields.ShowInAllCategory);
        Assert.Single(rows[0].Fields.Columns);
        Assert.Equal(2.0f, rows[0].Fields.Columns[0].FlexibleWidth);
        Assert.True(rows[0].Fields.Columns[0].IsItemName);
        Assert.False(rows[1].Fields.ShowInAllCategory);
        Assert.True(rows[1].Fields.Columns[0].IsItemValue);
    }

    [Fact]
    public void DiagnosesAssetMissingGuid()
    {
        var source = new FakeItemCategoryAssetSource(new[]
        {
            FakeItemCategoryAssetSource.BuildWithoutGuid("Floating Category"),
        });
        var extractor = new ItemCategoryExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    [Fact]
    public void DiagnosesNullColumnsInsteadOfThrowing()
    {
        var source = new FakeItemCategoryAssetSource(new[]
        {
            new ItemCategoryAsset(
                Guid: "category-malformed",
                AssetName: "Malformed",
                CategoryName: "Malformed",
                Icon: null,
                DefaultItemIcon: null,
                CategoryColor: new AssetColorSnapshot(),
                ShowInAllCategory: true,
                Columns: null),
        });
        var extractor = new ItemCategoryExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Single(rows);
        Assert.Empty(rows[0].Fields.Columns);
        Assert.Contains(extractor.Diagnostics, d =>
            d.Code == "itemCategoryColumnsMalformed" && d.Field == "columns" && d.Message.Contains("category-malformed"));
    }

    [Fact]
    public void CapturesCategoryIconAssetSlots()
    {
        var icon = (Sprite)RuntimeHelpers.GetUninitializedObject(typeof(Sprite));
        var defaultIcon = (Sprite)RuntimeHelpers.GetUninitializedObject(typeof(Sprite));
        var plan = new ItemIconAssetPlan();
        var source = new FakeItemCategoryAssetSource(new[]
        {
            FakeItemCategoryAssetSource.Build(
                guid: "category-weapons",
                name: "Weapons",
                showInAllCategory: true,
                icon: icon,
                defaultItemIcon: defaultIcon),
        });
        var extractor = new ItemCategoryExtractor(source, plan);

        _ = extractor.Walk().ToList();

        Assert.Contains(plan.Slots, slot =>
            slot.EntityId == "item-category" &&
            slot.RowId == "category-weapons" &&
            slot.Slot == "iconRef" &&
            ReferenceEquals(slot.Sprite, icon));
        Assert.Contains(plan.Slots, slot =>
            slot.EntityId == "item-category" &&
            slot.RowId == "category-weapons" &&
            slot.Slot == "defaultItemIconRef" &&
            ReferenceEquals(slot.Sprite, defaultIcon));
    }

    [Fact]
    public void BuiltLookupSourceDoesNotDiscoverCategoriesFromItemAssets()
    {
        var source = new BuiltLookupTableItemCategoryAssetSource(
            lookupCategories: () => System.Array.Empty<Ardenfall.ItemCategory>(),
            isUnityNull: _ => false);

        Assert.Empty(source.EnumerateItemCategories());
    }

    private sealed class FakeItemCategoryAssetSource : IItemCategoryAssetSource
    {
        private readonly IReadOnlyList<ItemCategoryAsset> _assets;

        public FakeItemCategoryAssetSource(IReadOnlyList<ItemCategoryAsset> assets)
        {
            _assets = assets;
        }

        public IEnumerable<ItemCategoryAsset> EnumerateItemCategories() => _assets;

        public static ItemCategoryAsset Build(
            string guid,
            string name,
            bool showInAllCategory,
            IReadOnlyList<ItemCategoryColumnAsset>? columns = null,
            Object? icon = null,
            Object? defaultItemIcon = null) => new(
                Guid: guid,
                AssetName: name,
                CategoryName: name,
                Icon: icon,
                DefaultItemIcon: defaultItemIcon,
                CategoryColor: new AssetColorSnapshot { R = 0.9f, G = 0.2f, B = 0.2f, A = 1f },
                ShowInAllCategory: showInAllCategory,
                Columns: columns ?? new List<ItemCategoryColumnAsset>());

        public static ItemCategoryAsset BuildWithoutGuid(string name) => new(
            Guid: null,
            AssetName: name,
            CategoryName: name,
            Icon: null,
            DefaultItemIcon: null,
            CategoryColor: new AssetColorSnapshot(),
            ShowInAllCategory: true,
            Columns: new List<ItemCategoryColumnAsset>());

        public static ItemCategoryColumnAsset Column(
            string label,
            float preferedWidth = 1f,
            float flexibleWidth = 0f,
            bool itemName = false,
            bool itemValue = false) => new(
                Label: label,
                Icon: null,
                PreferedWidth: preferedWidth,
                FlexibleWidth: flexibleWidth,
                IsItemName: itemName,
                IsItemIconAndCategory: false,
                IsItemValue: itemValue,
                IsAffectedBySkillRequirement: false,
                IsAffectedByBrokenDurability: false,
                AffectingRedColor: true,
                AffectingIconsAfter: false,
                HideIfNegativeOne: false,
                Alignment: "MiddleLeft",
                ItemDataField: null,
                ItemFunctionField: null);
    }

}
