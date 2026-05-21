using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Extraction;
using HotRepl.Control;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class EntityExportBatchCommand : IControlCommandHandler
{
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;


    public EntityExportBatchCommand(CompendiumRunManager runs, IItemExtractionCache items)
    {
        _runs = runs;
        _items = items;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "entity.exportBatch",
        1,
        ControlCommandKind.Job,
        mutatesState: true,
        argsSchema: CompendiumCommandSchemas.AnyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var validation = Validate(args, out var run, out var plan, out var offset, out var limit);
        if (validation != null)
            return new ValueTask<ControlCommandResult>(validation);

        cancellationToken.ThrowIfCancellationRequested();
        var rows = _items.GetOrExtract(run);
        if (rows.Count != plan.Total)
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Precondition("planChanged", $"Planned item total {plan.Total} no longer matches extracted total {rows.Count}."));
        var slice = rows.Skip(offset).Take(limit).ToList();
        var expectedWritten = System.Math.Min(plan.BatchSize, plan.Total - offset);
        if (slice.Count != expectedWritten)
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Precondition("batchIncomplete", $"Batch at offset {offset} wrote {slice.Count} rows; expected {expectedWritten}."));
        var envelope = new ItemSnapshotEnvelope { Rows = slice };
        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        Directory.CreateDirectory(chunksDir);
        var path = Path.Combine(chunksDir, $"{offset:D6}.json");
        var json = JsonConvert.SerializeObject(envelope, JsonSettings.Default);
        File.WriteAllText(path, json);
        var sha256 = ManifestBuilder.Sha256Hex(json);
        run.MarkEntityChunkComplete("item", offset, slice.Count);
        _runs.Save(run);

        var result = new JObject
        {
            ["entity"] = "item",
            ["offset"] = offset,
            ["limit"] = limit,
            ["written"] = slice.Count,
            ["total"] = rows.Count,
        };
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(
            result,
            CompendiumCommandResults.FileArtifact($"item.chunk.{offset:D6}", path, "application/json", sha256)));
    }

    private ControlCommandResult? Validate(JObject args, out CompendiumRun run, out CompendiumEntityRunPlan plan, out int offset, out int limit)
    {
        run = null!;
        plan = null!;
        offset = args["offset"]?.Value<int?>() ?? -1;
        limit = args["limit"]?.Value<int?>() ?? -1;

        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return CompendiumCommandResults.Validation("runIdRequired", "runId is required.");
        if (!_runs.TryGet(runId, out run))
            return CompendiumCommandResults.Validation("unknownRun", $"Unknown run '{runId}'.");
        if (run.Finalized)
            return CompendiumCommandResults.Precondition("runFinalized", $"Run '{runId}' is already finalized.");
        if (args["entity"]?.Value<string>() != "item")
            return CompendiumCommandResults.Validation("unsupportedEntity", "Only entity 'item' is supported.");
        if (!run.TryGetEntityPlan("item", out plan))
            return CompendiumCommandResults.Precondition("planMissing", $"Run '{runId}' does not have an item plan.");
        if (offset < 0)
            return CompendiumCommandResults.Validation("offsetInvalid", "offset must be zero or greater.");
        if (limit <= 0)
            return CompendiumCommandResults.Validation("limitInvalid", "limit must be greater than zero.");
        if (limit != plan.BatchSize)
            return CompendiumCommandResults.Validation("limitInvalid", $"limit must match planned batchSize {plan.BatchSize}.");
        if (!plan.IsExpectedOffset(offset))
            return CompendiumCommandResults.Validation("offsetInvalid", $"offset must be one of the planned item batch offsets.");
        return null;
    }
}
