using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using ArdenfallCompendium.Dtos;
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
        Assert.Equal("named;item-category;Weapons", rows[0].Id);
        Assert.Equal("Weapons", rows[0].Fields.CategoryName);
        Assert.True(rows[0].Fields.ShowInAllCategory);
        Assert.Single(rows[0].Fields.Columns);
        Assert.Equal(2.0f, rows[0].Fields.Columns[0].FlexibleWidth);
        Assert.True(rows[0].Fields.Columns[0].IsItemName);
        Assert.False(rows[1].Fields.ShowInAllCategory);
        Assert.True(rows[1].Fields.Columns[0].IsItemValue);
    }

    [Fact]
    public void EmptyCategoryNameIsFatal()
    {
        var source = new FakeItemCategoryAssetSource(new[]
        {
            FakeItemCategoryAssetSource.Build("ignored", " ", showInAllCategory: true),
        });
        var extractor = new ItemCategoryExtractor(source);

        Assert.Empty(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics, d => d.Code == "namedAssetNameMissing");
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Contains("ItemCategory", diagnostic.Message);
        Assert.Contains("' '", diagnostic.Message);
    }

    [Fact]
    public void IdenticalCategoryRepeatProducesDuplicateDiagnostic()
    {
        var source = new FakeItemCategoryAssetSource(new[]
        {
            FakeItemCategoryAssetSource.Build("one", "Same", showInAllCategory: true),
            FakeItemCategoryAssetSource.Build("two", "Same", showInAllCategory: true),
        });
        var extractor = new ItemCategoryExtractor(source);

        Assert.Single(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics, d => d.Code == "sourceYieldedDuplicateRecord");
        Assert.Equal("diagnostic", diagnostic.Severity);
        Assert.Contains("named;item-category;Same", diagnostic.Message);
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
                IconRef: null,
                DefaultItemIconRef: null,
                CategoryColor: new AssetColorSnapshot(),
                ShowInAllCategory: true,
                Columns: null),
        });
        var extractor = new ItemCategoryExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Single(rows);
        Assert.Empty(rows[0].Fields.Columns);
        Assert.Contains(extractor.Diagnostics, d =>
            d.Code == "itemCategoryColumnsMalformed" && d.Field == "columns" && d.Message?.Contains("named;item-category;Malformed") == true);
    }

    [Fact]
    public void PassesPlainIconReferencesThroughExtractor()
    {
        var icon = SnapshotRef.Missing("engineResource", "ItemCategory.icon");
        var defaultIcon = SnapshotRef.Missing("engineResource", "ItemCategory.defaultItemIcon");
        var source = new FakeItemCategoryAssetSource(new[]
        {
            FakeItemCategoryAssetSource.Build(
                guid: "category-weapons",
                name: "Weapons",
                showInAllCategory: true,
                icon: icon,
                defaultItemIcon: defaultIcon),
        });
        var extractor = new ItemCategoryExtractor(source);

        var row = Assert.Single(extractor.Walk().ToList());

        Assert.Equal(icon, row.Fields.IconRef);
        Assert.Equal(defaultIcon, row.Fields.DefaultItemIconRef);
    }

    [Fact]
    public void LoadedSourceDoesNotDiscoverCategoriesFromItemAssets()
    {
        var source = new LoadedItemCategoryAssetSource(
            loadedCategories: () => System.Array.Empty<Ardenfall.ItemCategory>(),
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
            SnapshotRef? icon = null,
            SnapshotRef? defaultItemIcon = null) => new(
                Guid: guid,
                AssetName: name,
                CategoryName: name,
                IconRef: icon,
                DefaultItemIconRef: defaultItemIcon,
                CategoryColor: new AssetColorSnapshot { R = 0.9f, G = 0.2f, B = 0.2f, A = 1f },
                ShowInAllCategory: showInAllCategory,
                Columns: columns ?? new List<ItemCategoryColumnAsset>());

        public static ItemCategoryColumnAsset Column(
            string label,
            float preferedWidth = 1f,
            float flexibleWidth = 0f,
            bool itemName = false,
            bool itemValue = false) => new(
                Label: label,
                IconRef: null,
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
