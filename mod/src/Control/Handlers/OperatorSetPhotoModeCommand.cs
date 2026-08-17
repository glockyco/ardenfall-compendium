using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

/// <summary>
/// Opens the game's free camera and lifts the retail roaming clamp, then puts both back.
/// </summary>
/// <remarks>
/// The clamp lives in the free-camera layer and consults <c>enableDebugTools</c> every frame, so photo
/// mode owns that flag for as long as it is enabled and restores the value the session found.
/// <para>
/// Enabling is synchronous, and disabling is not: the layer closes behind its close animation, and the
/// game's own close step is what clears the free camera and restores the timescale it paused. This
/// command therefore reports a pending close rather than a state the game has not reached, and it never
/// writes the timescale itself, because that would fight the close step.
/// </para>
/// </remarks>
public sealed class OperatorSetPhotoModeCommand
    : IControlCommandHandler<OperatorEnabledArgs, OperatorPhotoModeResult>
{
    private readonly IOperatorTarget _target;
    private readonly OperatorSessionLedger _session;

    public OperatorSetPhotoModeCommand(IOperatorTarget target, OperatorSessionLedger session)
    {
        _target = target;
        _session = session;
    }

    public string Name => "operator.setPhotoMode";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<OperatorPhotoModeResult>> ExecuteAsync(
        ControlCommandContext<OperatorPhotoModeResult> context,
        OperatorEnabledArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        var invalidArgs = CompendiumCommandResults.RequiredValue(context, args.Enabled, "enabled");
        if (invalidArgs != null) return new(invalidArgs);

        var missingGame = OperatorPreconditions.RequireGame(context, _target);
        if (missingGame != null) return new(missingGame);

        var missingCharacter = OperatorPreconditions.RequireCharacter(context, _target);
        if (missingCharacter != null) return new(missingCharacter);

        var closeRequested = args.Enabled!.Value ? Enable() : Disable();

        return new(
            ControlCommandResult.Ok(
                new OperatorPhotoModeResult
                {
                    PhotoMode = _target.FreeCameraEnabled && _target.DebugTools,
                    RoamingClampLifted = _target.DebugTools,
                    FreeCamera = _target.FreeCameraEnabled,
                    FreeCameraClosePending = closeRequested && _target.FreeCameraEnabled,
                    DebugTools = _target.DebugTools,
                }
            )
        );
    }

    /// <summary>Returns whether a free-camera close was requested. Enabling never requests one.</summary>
    private bool Enable()
    {
        var before = _target.DebugTools;
        _target.DebugTools = true;
        _session.NoteFlagChange(OperatorSessionKeys.DebugTools, before, _target.DebugTools);

        if (!_target.FreeCameraEnabled) _target.EnableFreeCamera();
        _session.MarkChanged(OperatorSessionKeys.PhotoMode);
        return false;
    }

    private bool Disable()
    {
        var closeRequested = _target.FreeCameraEnabled;
        if (closeRequested) _target.DisableFreeCamera();

        if (_session.TryTakeFlag(OperatorSessionKeys.DebugTools, out var original))
            _target.DebugTools = original;

        _session.ForgetChange(OperatorSessionKeys.PhotoMode);
        return closeRequested;
    }
}
