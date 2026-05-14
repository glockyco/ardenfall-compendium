using System.Collections.Generic;
using Ardenfall.Item;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Extraction;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemExtractionServiceTests
{
    [Fact]
    public void CachesRowsAfterFirstWalk()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var run = new CompendiumRun { RunId = "test" };

        var first = service.GetOrExtract(run);
        var second = service.GetOrExtract(run);

        Assert.Same(first, second);
        Assert.Equal(1, source.WalkCount);
    }

    private sealed class CountingItemAssetSource : IItemAssetSource
    {
        public int WalkCount { get; private set; }

        public IEnumerable<ItemData> EnumerateItems()
        {
            WalkCount++;
            yield break;
        }
    }
}
