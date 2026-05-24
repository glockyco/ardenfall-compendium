using System;
using System.Collections.Generic;
using System.Linq;
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
using HotRepl.Control;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class TypedCommandRegistryTests
{
    [Fact]
    public void Describe_GeneratesLowerCamelInputAndOutputSchemas()
    {
        var registry = new GlobalControlCommandRegistry();
        using var registration = registry.Register<RunBeginArgs, RunBeginResult>(
            new RunBeginCommand(new CompendiumRunManager(), "/tmp")
        );

        var descriptor = Assert.Single(registry.Describe(), d => d.Name == "run.begin");
        var argsSchema = descriptor.ArgsSchema.ToString();
        var resultSchema = descriptor.ResultSchema.ToString();

        Assert.Equal(1, descriptor.Version);
        Assert.Contains("outputBaseDir", argsSchema, StringComparison.Ordinal);
        Assert.DoesNotContain("OutputBaseDir", argsSchema, StringComparison.Ordinal);
        Assert.Contains("workspaceDir", resultSchema, StringComparison.Ordinal);
        Assert.DoesNotContain("WorkspaceDir", resultSchema, StringComparison.Ordinal);
        AssertRequiredProperties(descriptor.ResultSchema, "runId", "workspaceDir");
    }

    [Fact]
    public void Describe_AdvertisesBatchExportAsMutatingJobWithRequiredFields()
    {
        var registry = new GlobalControlCommandRegistry();
        using var registration = registry.Register<EntityExportBatchArgs, EntityExportBatchResult>(
            new EntityExportBatchCommand(new CompendiumRunManager(), new FakeItemExtractionCache())
        );

        var descriptor = Assert.Single(registry.Describe(), d => d.Name == "entity.exportBatch");

        Assert.Equal(ControlCommandKind.Job, descriptor.Kind);
        Assert.True(descriptor.MutatesState);
        AssertRequiredProperties(descriptor.ArgsSchema, "runId", "entity", "offset", "limit");
        AssertRequiredProperties(
            descriptor.ResultSchema,
            "entity",
            "offset",
            "limit",
            "written",
            "total"
        );
        Assert.Contains("runId", descriptor.ArgsSchema.ToString(), StringComparison.Ordinal);
        Assert.Contains("written", descriptor.ResultSchema.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ExportBatch_RejectsBlankRunAndEntityBeforeLookup()
    {
        var command = new EntityExportBatchCommand(
            new CompendiumRunManager(),
            new FakeItemExtractionCache()
        );

        var blankRun = await command.ExecuteAsync(
            TestControlCommandContext.Create<EntityExportBatchResult>(),
            new EntityExportBatchArgs { RunId = "", Entity = "item", Offset = 0, Limit = 1 },
            CancellationToken.None
        );
        var blankEntity = await command.ExecuteAsync(
            TestControlCommandContext.Create<EntityExportBatchResult>(),
            new EntityExportBatchArgs { RunId = "run-1", Entity = "", Offset = 0, Limit = 1 },
            CancellationToken.None
        );

        Assert.Contains(blankRun.Diagnostics, error => error.Code == "runIdRequired");
        Assert.Contains(blankEntity.Diagnostics, error => error.Code == "entityRequired");
    }

    private static void AssertRequiredProperties(JObject schema, params string[] expected)
    {
        var actual = schema["required"]?.Values<string>()
            .Where(value => value != null)
            .Select(value => value!)
            .ToHashSet(StringComparer.Ordinal) ?? new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in expected)
        {
            Assert.Contains(property, actual);
        }
    }

    private sealed class FakeItemExtractionCache : IItemExtractionCache
    {
        public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run) =>
            Array.Empty<ItemSnapshotRow>();

        public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => new();

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) =>
            Array.Empty<Diagnostic>();
    }
}
