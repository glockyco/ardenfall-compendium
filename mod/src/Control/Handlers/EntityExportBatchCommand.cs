using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Extraction;
using HotRepl.Control;
using HotRepl.Control.Artifacts;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class EntityExportBatchCommand
    : IControlCommandHandler<EntityExportBatchArgs, EntityExportBatchResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;

    public EntityExportBatchCommand(CompendiumRunManager runs, IItemExtractionCache items)
    {
        _runs = runs;
        _items = items;
    }

    public string Name => "entity.exportBatch";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Job;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<EntityExportBatchResult>> ExecuteAsync(
        ControlCommandContext<EntityExportBatchResult> context,
        EntityExportBatchArgs args,
        CancellationToken cancellationToken
    )
    {
        var validation = Validate(context, args, out var run, out var plan);
        if (validation != null) return new(validation);

        cancellationToken.ThrowIfCancellationRequested();
        var rows = _items.GetOrExtract(run);
        if (rows.Count != plan.Total)
            return new(
                CompendiumCommandResults.Precondition(
                    context,
                    "planChanged",
                    $"Planned item total {plan.Total} no longer matches extracted total {rows.Count}."
                )
            );
        var slice = rows.Skip(args.Offset).Take(args.Limit).ToList();
        var expectedWritten = Math.Min(plan.BatchSize, plan.Total - args.Offset);
        if (slice.Count != expectedWritten)
            return new(
                CompendiumCommandResults.Precondition(
                    context,
                    "batchIncomplete",
                    $"Batch at offset {args.Offset} wrote {slice.Count} rows; expected {expectedWritten}."
                )
            );
        var envelope = new ItemSnapshotEnvelope { Rows = slice };
        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        Directory.CreateDirectory(chunksDir);
        var path = Path.Combine(chunksDir, $"{args.Offset:D6}.json");
        var json = JsonConvert.SerializeObject(envelope, JsonSettings.Default);
        File.WriteAllText(path, json);
        var sha256 = ManifestBuilder.Sha256Hex(json);
        run.MarkEntityChunkComplete("item", args.Offset, slice.Count);
        _runs.Save(run);

        var result = new EntityExportBatchResult
        {
            Entity = "item",
            Offset = args.Offset,
            Limit = args.Limit,
            Written = slice.Count,
            Total = rows.Count,
        };
        var artifacts = new Dictionary<string, ArtifactRef>(StringComparer.Ordinal)
        {
            [$"item.chunk.{args.Offset:D6}"] = CompendiumCommandResults.FileArtifact(
                $"item.chunk.{args.Offset:D6}",
                path,
                "application/json",
                sha256
            ),
        };
        return new(ControlCommandResult.Ok(result, artifacts));
    }

    private ControlCommandResult<EntityExportBatchResult>? Validate(
        ControlCommandContext<EntityExportBatchResult> context,
        EntityExportBatchArgs args,
        out CompendiumRun run,
        out CompendiumEntityRunPlan plan
    )
    {
        run = null!;
        plan = null!;
        var runIdValidation = CompendiumCommandResults.RequiredString(
            context,
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return runIdValidation;
        var entityValidation = CompendiumCommandResults.RequiredString(
            context,
            args.Entity,
            "entity"
        );
        if (entityValidation != null) return entityValidation;

        if (!_runs.TryGet(args.RunId, out run))
            return CompendiumCommandResults.Validation(
                context,
                "unknownRun",
                $"Unknown run '{args.RunId}'."
            );
        if (run.Finalized)
            return CompendiumCommandResults.Precondition(
                context,
                "runFinalized",
                $"Run '{args.RunId}' is already finalized."
            );
        if (!string.Equals(args.Entity, "item", StringComparison.Ordinal))
            return CompendiumCommandResults.Validation(
                context,
                "unsupportedEntity",
                "Only entity 'item' is supported."
            );
        if (!run.TryGetEntityPlan("item", out plan))
            return CompendiumCommandResults.Precondition(
                context,
                "planMissing",
                $"Run '{args.RunId}' does not have an item plan."
            );
        if (args.Offset < 0)
            return CompendiumCommandResults.Validation(
                context,
                "offsetInvalid",
                "offset must be zero or greater."
            );
        if (args.Limit <= 0)
            return CompendiumCommandResults.Validation(
                context,
                "limitInvalid",
                "limit must be greater than zero."
            );
        if (args.Limit != plan.BatchSize)
            return CompendiumCommandResults.Validation(
                context,
                "limitInvalid",
                $"limit must match planned batchSize {plan.BatchSize}."
            );
        if (!plan.IsExpectedOffset(args.Offset))
            return CompendiumCommandResults.Validation(
                context,
                "offsetInvalid",
                "offset must be one of the planned item batch offsets."
            );
        return null;
    }
}
