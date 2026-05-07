using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallArchives.Emit;
using ArdenfallArchives.Entities.Item;
using HotRepl.Control;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control.Handlers;

public sealed class EntityExportBatchCommand : IControlCommandHandler
{
    private readonly ArchiveRunManager _runs;

    public EntityExportBatchCommand(ArchiveRunManager runs)
    {
        _runs = runs;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "entity.exportBatch",
        1,
        ControlCommandKind.Job,
        mutatesState: true,
        argsSchema: ArchiveCommandSchemas.AnyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var validation = Validate(args, out var run, out var offset, out var limit);
        if (validation != null)
            return new ValueTask<ControlCommandResult>(validation);

        cancellationToken.ThrowIfCancellationRequested();
        var rows = new ItemExtractor().Walk().ToList();
        var slice = rows.Skip(offset).Take(limit).ToList();
        var envelope = new ItemSnapshotEnvelope { Rows = slice };
        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        Directory.CreateDirectory(chunksDir);
        var path = Path.Combine(chunksDir, $"{offset:D6}.json");
        var json = JsonConvert.SerializeObject(envelope, JsonSettings.Default);
        File.WriteAllText(path, json);
        var sha256 = ManifestBuilder.Sha256Hex(json);
        run.Counts["item"] = offset + slice.Count;

        var result = new JObject
        {
            ["entity"] = "item",
            ["offset"] = offset,
            ["limit"] = limit,
            ["written"] = slice.Count,
            ["total"] = rows.Count,
        };
        return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Ok(
            result,
            ArchiveCommandResults.FileArtifact($"item.chunk.{offset:D6}", path, "application/json", sha256)));
    }

    private ControlCommandResult? Validate(JObject args, out ArchiveRun run, out int offset, out int limit)
    {
        run = null!;
        offset = args["offset"]?.Value<int?>() ?? -1;
        limit = args["limit"]?.Value<int?>() ?? -1;

        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return ArchiveCommandResults.Validation("runIdRequired", "runId is required.");
        if (!_runs.TryGet(runId, out run))
            return ArchiveCommandResults.Validation("unknownRun", $"Unknown run '{runId}'.");
        if (run.Finalized)
            return ArchiveCommandResults.Precondition("runFinalized", $"Run '{runId}' is already finalized.");
        if (args["entity"]?.Value<string>() != "item")
            return ArchiveCommandResults.Validation("unsupportedEntity", "Only entity 'item' is supported.");
        if (offset < 0)
            return ArchiveCommandResults.Validation("offsetInvalid", "offset must be zero or greater.");
        if (limit <= 0)
            return ArchiveCommandResults.Validation("limitInvalid", "limit must be greater than zero.");
        return null;
    }
}
