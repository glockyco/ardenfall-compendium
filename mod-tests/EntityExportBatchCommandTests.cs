using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Extraction;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EntityExportBatchCommandTests
{
    [Fact]
    public async Task RejectsExportBeforeEntityPlan()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-batch-plan-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        var command = new EntityExportBatchCommand(runs, new FakeItemExtractionCache(Row("item-a")));

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<EntityExportBatchResult>(),
            new EntityExportBatchArgs { RunId = run.RunId, Entity = "item", Offset = 0, Limit = 1 },
            CancellationToken.None);

        Assert.Contains(result.Diagnostics, error => error.Code == "planMissing");
    }

    [Fact]
    public async Task WritesChunkAndMarksCompletedPlanOffset()
    {
        var rows = new[] { Row("item-a"), Row("item-b") };
        var cache = new FakeItemExtractionCache(rows);
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-batch-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        run.SetEntityPlan("item", total: 2, batchSize: 1);
        runs.Save(run);
        var command = new EntityExportBatchCommand(runs, cache);

        var result = await command.ExecuteAsync(
            TestControlCommandContext.Create<EntityExportBatchResult>(),
            new EntityExportBatchArgs { RunId = run.RunId, Entity = "item", Offset = 0, Limit = 1 },
            CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        Assert.True(result.Succeeded);
        Assert.Equal(1, result.Output!.Written);
        Assert.Contains("item.chunk.000000", result.Artifacts.Keys);
        Assert.True(run.TryGetEntityPlan("item", out var plan));
        Assert.True(plan.IsComplete(0));
        Assert.Equal(1, run.Counts["item"]);
        Assert.True(File.Exists(Path.Combine(run.WorkspaceDir, "entities", "item", "chunks", "000000.json")));
        Assert.Contains("\"offset\": 0", File.ReadAllText(Path.Combine(run.WorkspaceDir, "control", "run.json")));
    }

    private static ItemSnapshotRow Row(string id) => new()
    {
        Id = id,
        Fields = new Dictionary<string, object?>(),
    };

    private sealed class FakeItemExtractionCache : IItemExtractionCache
    {
        private readonly IReadOnlyList<ItemSnapshotRow> _rows;

        public FakeItemExtractionCache(params ItemSnapshotRow[] rows)
        {
            _rows = rows;
        }

        public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => new();

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => System.Array.Empty<Diagnostic>();
    }
}
