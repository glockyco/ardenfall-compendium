using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemExtractorTests
{
    [Fact]
    public void ParentRefIsEmittedInsideFieldsWithoutChangingExistingValues()
    {
        var parentRef = SnapshotRef.LookupAsset("parent-guid", "Ardenfall.Item.ItemData", "Base sword");
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Azure sword",
            ["weight"] = 2.5f,
            ["parentRef"] = parentRef,
        };
        var extractor = new ItemExtractor(new FakeItemSource(new ItemAsset(
            "item-guid",
            "Azure sword",
            new ItemSnapshotRow { Id = "item-guid", Variant = "basic", Fields = fields })));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("Azure sword", row.Fields["name"]);
        Assert.Equal(2.5f, row.Fields["weight"]);
        var resolvedParent = Assert.IsType<SnapshotRef>(row.Fields["parentRef"]);
        Assert.Equal("lookupAsset", resolvedParent.Kind);
        Assert.Equal("parent-guid", resolvedParent.Guid);
    }

    [Fact]
    public void ParentRefRecordsNoParentInsideFields()
    {
        var extractor = new ItemExtractor(new FakeItemSource(new ItemAsset(
            "item-guid",
            "Standalone item",
            new ItemSnapshotRow
            {
                Id = "item-guid",
                Variant = "basic",
                Fields = new Dictionary<string, object?>
                {
                    ["name"] = "Standalone item",
                    ["parentRef"] = SnapshotRef.Missing("noParent", "ParameterizedObject.parent"),
                },
            })));

        var row = Assert.Single(extractor.Walk());

        var parentRef = Assert.IsType<SnapshotRef>(row.Fields["parentRef"]);
        Assert.Equal("missing", parentRef.Kind);
        Assert.Equal("noParent", parentRef.Reason);
        Assert.Equal("ParameterizedObject.parent", parentRef.Source);
        Assert.Equal("Standalone item", row.Fields["name"]);
    }

    [Fact]
    public void DiagnosesNullAssetWithoutUnity()
    {
        var source = new FakeItemSource((ItemAsset)null!);
        var extractor = new ItemExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Equal("itemAssetMissing", diagnostic.Code);
        Assert.Equal("id", diagnostic.Field);
        Assert.Equal("Item asset source yielded a null row", diagnostic.Message);
    }

    private sealed class FakeItemSource : IItemAssetSource
    {
        private readonly IReadOnlyList<ItemAsset> _items;

        public FakeItemSource(params ItemAsset[] items)
        {
            _items = items;
        }

        public IEnumerable<ItemAsset> EnumerateItems() => _items;
    }
}
