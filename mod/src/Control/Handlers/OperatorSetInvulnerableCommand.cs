using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class OperatorSetInvulnerableCommand
    : IControlCommandHandler<OperatorEnabledArgs, OperatorInvulnerableResult>
{
    private readonly IOperatorTarget _target;
    private readonly OperatorSessionLedger _session;

    public OperatorSetInvulnerableCommand(IOperatorTarget target, OperatorSessionLedger session)
    {
        _target = target;
        _session = session;
    }

    public string Name => "operator.setInvulnerable";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<OperatorInvulnerableResult>> ExecuteAsync(
        ControlCommandContext<OperatorInvulnerableResult> context,
        OperatorEnabledArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        var invalidArgs = CompendiumCommandResults.RequiredValue(context, args.Enabled, "enabled");
        if (invalidArgs != null) return new(invalidArgs);

        var unavailable = OperatorPreconditions.RequireCharacter(context, _target);
        if (unavailable != null) return new(unavailable);

        var before = _target.Invulnerable;
        _target.Invulnerable = args.Enabled!.Value;
        var after = _target.Invulnerable;
        _session.NoteFlagChange(OperatorSessionKeys.Invulnerable, before, after);

        return new(
            ControlCommandResult.Ok(new OperatorInvulnerableResult { Invulnerable = after })
        );
    }
}
