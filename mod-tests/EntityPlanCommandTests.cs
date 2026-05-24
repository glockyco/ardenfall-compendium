using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Extraction;
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
            TestControlCommandContext.Create<EntityPlanResult>(),
            new EntityPlanArgs { RunId = run.RunId, Entity = "item" },
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Empty(result.Diagnostics);
        Assert.Equal(0, result.Output!.Total);
        Assert.Equal(1, source.WalkCount);
    }
}
