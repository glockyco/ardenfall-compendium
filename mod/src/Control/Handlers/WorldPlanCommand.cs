using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Entities.World;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

/// <summary>Plans a walk over the build's cell scenes, in build-index order.</summary>
public sealed class WorldPlanCommand : IControlCommandHandler<RunIdArgs, WorldPlanResult>
{
    /// <summary>Cells loaded at once. Three is what the measured walk used.</summary>
    public const int BatchSize = 3;

    private readonly CompendiumRunManager _runs;
    private readonly ISceneTable _scenes;

    public WorldPlanCommand(CompendiumRunManager runs, ISceneTable scenes)
    {
        _runs = runs;
        _scenes = scenes;
    }

    public string Name => "world.plan";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<WorldPlanResult>> ExecuteAsync(
        ControlCommandContext<WorldPlanResult> context,
        RunIdArgs args,
        CancellationToken cancellationToken)
    {
        var runIdValidation = CompendiumCommandResults.RequiredString(context, args.RunId, "runId");
        if (runIdValidation != null) return new(runIdValidation);
        if (!_runs.TryGet(args.RunId, out var run))
            return new(CompendiumCommandResults.Validation(
                context,
                "unknownRun",
                $"Run '{args.RunId}' is not open."));

        var plan = CellSceneInventory.Plan(_scenes);
        run.SetWorldPlan(plan.Cells.Select(cell => cell.Name).ToList(), BatchSize);
        _runs.Save(run);

        return new(ControlCommandResult.Ok(new WorldPlanResult
        {
            Total = plan.Cells.Count,
            BatchSize = BatchSize,
            ScenesInBuild = plan.ScenesInBuild,
            Unloadable = plan.Unloadable,
            Cells = plan.Cells
                .Select(cell => new WorldPlanCell { BuildIndex = cell.BuildIndex, Name = cell.Name })
                .ToList(),
        }));
    }
}
