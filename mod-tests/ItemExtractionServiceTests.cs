using ArdenfallCompendium.Control;
using ArdenfallCompendium.Extraction;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemExtractionServiceTests
{
    [Fact]
    public void EvictsRowsAfterRunCompletes()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var run = new CompendiumRun { RunId = "test" };

        _ = service.GetOrExtract(run);
        service.Evict(run);
        _ = service.GetOrExtract(run);

        Assert.Equal(2, source.WalkCount);
    }

    [Fact]
    public void ReusesRowsForSameRun()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var run = new CompendiumRun { RunId = "test" };

        var first = service.GetOrExtract(run);
        var second = service.GetOrExtract(run);

        Assert.Same(first, second);
        Assert.Equal(1, source.WalkCount);
    }
}
