using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Extraction;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class RunDiscardCacheEvictionTests
{
    [Fact]
    public async Task DiscardEvictsExtractionCacheState()
    {
        var source = new CountingItemAssetSource();
        var cache = new ItemExtractionService(source);
        var runs = new CompendiumRunManager();
        var outputBaseDir = System.IO.Directory.CreateTempSubdirectory("ardenfall-discard-cache-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        _ = cache.GetOrExtract(run);

        var command = new RunDiscardCommand(runs, new IExtractionCache[] { cache });
        _ = await command.ExecuteAsync(
            TestControlCommandContext.Create<RunDiscardResult>(),
            new RunIdArgs { RunId = run.RunId },
            CancellationToken.None);

        _ = cache.GetOrExtract(run);

        Assert.Equal(2, source.WalkCount);
    }
}
