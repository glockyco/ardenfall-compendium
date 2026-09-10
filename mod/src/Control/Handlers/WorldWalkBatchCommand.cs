using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.World;
using HotRepl.Control;
using HotRepl.Control.Artifacts;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Handlers;

/// <summary>
/// Walks one batch of cell scenes and writes what it harvested.
/// </summary>
/// <remarks>
/// A job rather than a sync command, because an additive load completes at the end of a frame and
/// the walk therefore spans frames.
/// </remarks>
public sealed class WorldWalkBatchCommand
    : IControlCommandHandler<WorldWalkBatchArgs, WorldWalkBatchResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly ISceneTable _scenes;
    private readonly Func<
        IReadOnlyList<CellScene>,
        Action<CellWalkBatch>,
        CancellationToken,
        Task<CellWalkBatch>> _walk;

    public WorldWalkBatchCommand(
        CompendiumRunManager runs,
        ISceneTable scenes,
        Func<
            IReadOnlyList<CellScene>,
            Action<CellWalkBatch>,
            CancellationToken,
            Task<CellWalkBatch>> walk)
    {
        _runs = runs;
        _scenes = scenes;
        _walk = walk;
    }

    public string Name => "world.walkBatch";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Job;

    public bool MutatesState => true;

    public async ValueTask<ControlCommandResult<WorldWalkBatchResult>> ExecuteAsync(
        ControlCommandContext<WorldWalkBatchResult> context,
        WorldWalkBatchArgs args,
        CancellationToken cancellationToken)
    {
        var runIdValidation = CompendiumCommandResults.RequiredString(context, args.RunId, "runId");
        if (runIdValidation != null) return runIdValidation;
        if (!_runs.TryGet(args.RunId, out var run))
            return CompendiumCommandResults.Validation(
                context,
                "unknownRun",
                $"Run '{args.RunId}' is not open.");
        if (run.WorldPlan == null)
            return CompendiumCommandResults.Precondition(
                context,
                "worldPlanMissing",
                "Call world.plan before world.walkBatch.");
        if (args.Offset < 0 || args.Limit <= 0)
            return CompendiumCommandResults.Validation(
                context,
                "invalidBatch",
                $"Batch offset {args.Offset} and limit {args.Limit} do not describe a batch.");

        var planned = CellSceneInventory.Plan(_scenes).Cells;
        var byName = planned.ToDictionary(cell => cell.Name, StringComparer.Ordinal);
        var names = run.WorldPlan.Cells.Skip(args.Offset).Take(args.Limit).ToList();
        var missing = names.Where(name => !byName.ContainsKey(name)).ToList();
        if (missing.Count > 0)
            return CompendiumCommandResults.Precondition(
                context,
                "planChanged",
                $"Planned cells are no longer in the build: {string.Join(", ", missing)}.");

        var cells = names.Select(name => byName[name]).ToList();
        var path = Path.Combine(
            run.WorkspaceDir,
            "entities",
            "placed-plant",
            "chunks",
            $"{args.Offset:D6}.json");
        var json = string.Empty;
        var rows = new List<PlacedPlantFields>();
        CellWalkBatch batch;
        try
        {
            // The commit runs on the main thread, inside the walk's own frame. Everything after the
            // await continues on a pool thread, where the game's file APIs are not ours to call.
            batch = await _walk(
                cells,
                walked =>
                {
                    rows = walked.Cells.SelectMany(cell => cell.Plants).ToList();
                    json = JsonConvert.SerializeObject(
                        new PlacedPlantSnapshotEnvelope { Rows = rows },
                        JsonSettings.Default);
                    AtomicFile.WriteAllText(path, json);
                    run.WorldPlan.MarkWalked(walked.Cells.Select(cell => cell.Cell));
                    run.Counts["placed-plant"] =
                        run.Counts.TryGetValue("placed-plant", out var seen)
                            ? seen + rows.Count
                            : rows.Count;
                    _runs.Save(run);
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (InvalidOperationException ex)
        {
            return CompendiumCommandResults.Precondition(context, "walkChangedState", ex.Message);
        }

        var result = new WorldWalkBatchResult
        {
            Offset = args.Offset,
            Limit = args.Limit,
            Walked = batch.Cells.Count,
            Pending = run.WorldPlan.Pending,
            Cells = batch.Cells
                .Select(cell => new WorldWalkCellReport
                {
                    Cell = cell.Cell,
                    ObjectsSeen = cell.ObjectsSeen,
                    Harvested = cell.Plants.Count,
                    Diagnostics = cell.Diagnostics.Count,
                })
                .ToList(),
            UnmodelledTypes = new Dictionary<string, int>(batch.UnmodelledTypes, StringComparer.Ordinal),
        };
        var artifacts = new Dictionary<string, ArtifactRef>(StringComparer.Ordinal)
        {
            [$"placed-plant.chunk.{args.Offset:D6}"] = CompendiumCommandResults.FileArtifact(
                $"placed-plant.chunk.{args.Offset:D6}",
                path,
                "application/json",
                ManifestBuilder.Sha256Hex(json)),
        };
        return ControlCommandResult.Ok(result, artifacts);
    }
}
