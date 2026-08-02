using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Extraction;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunDiscardCommand : IControlCommandHandler<RunIdArgs, RunDiscardResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly IReadOnlyList<IExtractionCache> _caches;

    public RunDiscardCommand(CompendiumRunManager runs, IReadOnlyList<IExtractionCache> caches)
    {
        _runs = runs;
        _caches = caches;
    }

    public string Name => "run.discard";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<RunDiscardResult>> ExecuteAsync(
        ControlCommandContext<RunDiscardResult> context,
        RunIdArgs args,
        CancellationToken cancellationToken
    )
    {
        var runIdValidation = CompendiumCommandResults.RequiredString(
            context,
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return new(runIdValidation);
        var discarded = _runs.Discard(args.RunId);
        if (discarded != null)
        {
            foreach (var cache in _caches) cache.Evict(discarded);
        }
        return new(
            ControlCommandResult.Ok(
                new RunDiscardResult { RunId = args.RunId, Discarded = true }
            )
        );
    }
}
