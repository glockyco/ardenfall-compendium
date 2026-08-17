using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class OperatorRecoverFromDeathCommand
    : IControlCommandHandler<EmptyArgs, OperatorDeathRecoveryResult>
{
    private readonly IOperatorTarget _target;

    public OperatorRecoverFromDeathCommand(IOperatorTarget target)
    {
        _target = target;
    }

    public string Name => "operator.recoverFromDeath";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<OperatorDeathRecoveryResult>> ExecuteAsync(
        ControlCommandContext<OperatorDeathRecoveryResult> context,
        EmptyArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        var unavailable = OperatorPreconditions.RequireCharacter(context, _target);
        if (unavailable != null) return new(unavailable);

        // Read both states first: reviving closes the death interface itself, so a later read cannot
        // tell whether that interface needed closing.
        var wasDead = _target.IsDead;
        var interfaceWasOpen = _target.DeathInterfaceOpen;

        if (wasDead) _target.Revive();
        if (_target.DeathInterfaceOpen) _target.CloseDeathInterface();

        // The game plays the death clip with stopOnFinish false, so the pose outlives a plain revive.
        _target.StopAnimationOverride();
        _target.RefreshAnimatorState();

        return new(
            ControlCommandResult.Ok(
                new OperatorDeathRecoveryResult
                {
                    Alive = !_target.IsDead,
                    Revived = wasDead,
                    DeathInterfaceClosed = interfaceWasOpen,
                    AnimationOverrideStopped = true,
                }
            )
        );
    }
}
