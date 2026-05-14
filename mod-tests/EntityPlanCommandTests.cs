using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Extraction;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EntityPlanCommandTests
{
    [Fact]
    public async Task UsesCachedExtractionRowsForRunCount()
    {
        var source = new CountingItemAssetSource();
        var service = new ItemExtractionService(source);
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-plan-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        var command = new EntityPlanCommand(runs, service);

        var result = await command.ExecuteAsync(
            null!,
            new JObject { ["runId"] = run.RunId, ["entity"] = "item" },
            CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        Assert.Equal(0, result.Result["total"]!.Value<int>());
        Assert.Equal(1, source.WalkCount);
    }
}
