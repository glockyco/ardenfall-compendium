using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunStatusCommand : IControlCommandHandler<RunIdArgs, RunStatusResult>
{
    private readonly CompendiumRunManager _runs;

    public RunStatusCommand(CompendiumRunManager runs)
    {
        _runs = runs;
    }

    public string Name => "run.status";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Synchronous;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<RunStatusResult>> ExecuteAsync(
        ControlCommandContext context,
        RunIdArgs args,
        CancellationToken cancellationToken
    )
    {
        var runIdValidation = CompendiumCommandResults.RequiredString<RunStatusResult>(
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return new(runIdValidation);
        if (!_runs.TryGet(args.RunId, out var run))
            return new(
                CompendiumCommandResults.Validation<RunStatusResult>(
                    "unknownRun",
                    $"Unknown run '{args.RunId}'."
                )
            );

        return new(
            ControlCommandResult.Ok(
                new RunStatusResult
                {
                    RunId = run.RunId,
                    State = run.State,
                    Counts = run.Counts,
                    Finalized = run.Finalized,
                    WorkspaceDir = run.WorkspaceDir,
                    PublishedDir = run.PublishedDir,
                }
            )
        );
    }
}
