using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.Item;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemExtractorTests
{
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
