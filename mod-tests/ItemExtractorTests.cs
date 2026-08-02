using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemExtractorTests
{
    [Fact]
    public void DiagnosesNullAsset()
    {
        var source = new FakeItemSource((ItemData)null!);
        var extractor = new ItemExtractor(source, assetPlan: null, lookupGuid: _ => null);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Equal("itemAssetMissing", diagnostic.Code);
        Assert.Equal("id", diagnostic.Field);
        Assert.Equal("Item asset source yielded a null ItemData row", diagnostic.Message);
    }

    // Known coverage limitation: the lookup-returns-null branch cannot be reached outside
    // Unity because an uninitialized ItemData is treated as null by Unity's overloaded operator.
    private sealed class FakeItemSource : IItemAssetSource
    {
        private readonly IReadOnlyList<ItemData> _items;

        public FakeItemSource(params ItemData[] items)
        {
            _items = items;
        }

        public IEnumerable<ItemData> EnumerateItems() => _items;
    }
}
