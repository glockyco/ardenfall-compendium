using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunDiscardCommand : IControlCommandHandler<RunIdArgs, RunDiscardResult>
{
    private readonly CompendiumRunManager _runs;

    public RunDiscardCommand(CompendiumRunManager runs)
    {
        _runs = runs;
    }

    public string Name => "run.discard";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Synchronous;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<RunDiscardResult>> ExecuteAsync(
        ControlCommandContext context,
        RunIdArgs args,
        CancellationToken cancellationToken
    )
    {
        var runIdValidation = CompendiumCommandResults.RequiredString<RunDiscardResult>(
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return new(runIdValidation);
        _runs.Discard(args.RunId);
        return new(
            ControlCommandResult.Ok(
                new RunDiscardResult { RunId = args.RunId, Discarded = true }
            )
        );
    }
}
