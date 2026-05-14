using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Extraction;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EntityExportBatchCommandTests
{
    [Fact]
    public async Task UsesCachedExtractionRowsAcrossBatches()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-batch-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        var command = new EntityExportBatchCommand(runs, service);

        var first = await command.ExecuteAsync(
            null!,
            new JObject { ["runId"] = run.RunId, ["entity"] = "item", ["offset"] = 0, ["limit"] = 100 },
            CancellationToken.None);
        var second = await command.ExecuteAsync(
            null!,
            new JObject { ["runId"] = run.RunId, ["entity"] = "item", ["offset"] = 100, ["limit"] = 100 },
            CancellationToken.None);

        Assert.Empty(first.Diagnostics);
        Assert.Empty(second.Diagnostics);
        Assert.Equal(1, source.WalkCount);
    }
}
