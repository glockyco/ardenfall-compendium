using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class OperatorStatusCommand
    : IControlCommandHandler<EmptyArgs, OperatorStatusResult>
{
    private readonly IOperatorTarget _target;
    private readonly OperatorSessionLedger _session;

    public OperatorStatusCommand(IOperatorTarget target, OperatorSessionLedger session)
    {
        _target = target;
        _session = session;
    }

    public string Name => "operator.status";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<OperatorStatusResult>> ExecuteAsync(
        ControlCommandContext<OperatorStatusResult> context,
        EmptyArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        var missingGame = OperatorPreconditions.RequireGame(context, _target);
        if (missingGame != null) return new(missingGame);

        var missingCharacter = OperatorPreconditions.RequireCharacter(context, _target);
        if (missingCharacter != null) return new(missingCharacter);

        // The game restores some values on its own, such as the timescale it pauses for the free
        // camera. Reconcile first so the changed set describes the live session.
        _session.ReconcileFlag(OperatorSessionKeys.Invulnerable, _target.Invulnerable);
        _session.ReconcileFlag(OperatorSessionKeys.DebugTools, _target.DebugTools);
        _session.ReconcileNumber(OperatorSessionKeys.Timescale, _target.Timescale);

        return new(
            ControlCommandResult.Ok(
                new OperatorStatusResult
                {
                    Invulnerable = _target.Invulnerable,
                    PhotoMode = _target.FreeCameraEnabled && _target.DebugTools,
                    Timescale = _target.Timescale,
                    RoamingClampLifted = _target.DebugTools,
                    DebugTools = _target.DebugTools,
                    Changed = _session.ChangedKeys,
                }
            )
        );
    }
}
