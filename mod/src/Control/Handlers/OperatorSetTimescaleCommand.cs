using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class OperatorSetTimescaleCommand
    : IControlCommandHandler<OperatorTimescaleArgs, OperatorTimescaleResult>
{
    public const string ScaleOutOfRangeCode = "scaleOutOfRange";

    private readonly IOperatorTarget _target;
    private readonly OperatorSessionLedger _session;

    public OperatorSetTimescaleCommand(IOperatorTarget target, OperatorSessionLedger session)
    {
        _target = target;
        _session = session;
    }

    public string Name => "operator.setTimescale";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<OperatorTimescaleResult>> ExecuteAsync(
        ControlCommandContext<OperatorTimescaleResult> context,
        OperatorTimescaleArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        var invalidArgs = CompendiumCommandResults.RequiredValue(context, args.Scale, "scale");
        if (invalidArgs != null) return new(invalidArgs);

        var scale = args.Scale!.Value;

        // The comparison is written positively so a NaN fails it.
        if (!(scale >= 0f && scale <= 1f))
        {
            return new(
                CompendiumCommandResults.Validation(
                    context,
                    ScaleOutOfRangeCode,
                    "scale must be a number from 0 through 1 inclusive."
                )
            );
        }

        var unavailable = OperatorPreconditions.RequireGame(context, _target);
        if (unavailable != null) return new(unavailable);

        var before = _target.Timescale;
        _target.Timescale = scale;
        var after = _target.Timescale;
        _session.NoteNumberChange(OperatorSessionKeys.Timescale, before, after);

        return new(ControlCommandResult.Ok(new OperatorTimescaleResult { Timescale = after }));
    }
}
