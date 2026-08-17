using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.OperatorTools;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class OperatorTeleportCommand
    : IControlCommandHandler<OperatorTeleportArgs, OperatorTeleportResult>
{
    public const string SurfaceMissingCode = "surfaceMissing";

    /// <summary>
    /// How far above the surface the character lands. Measured with the probe that placed a character on
    /// a pier without a fall.
    /// </summary>
    private const float SurfaceClearance = 1.2f;

    private readonly IOperatorTarget _target;

    public OperatorTeleportCommand(IOperatorTarget target)
    {
        _target = target;
    }

    public string Name => "operator.teleport";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<OperatorTeleportResult>> ExecuteAsync(
        ControlCommandContext<OperatorTeleportResult> context,
        OperatorTeleportArgs args,
        CancellationToken cancellationToken
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        var missingX = CompendiumCommandResults.RequiredValue(context, args.X, "x");
        if (missingX != null) return new(missingX);

        var missingZ = CompendiumCommandResults.RequiredValue(context, args.Z, "z");
        if (missingZ != null) return new(missingZ);

        var unavailable = OperatorPreconditions.RequireCharacter(context, _target);
        if (unavailable != null) return new(unavailable);

        var x = args.X!.Value;
        var z = args.Z!.Value;

        var surface = _target.FindSurface(x, z);
        if (surface == null)
        {
            return new(
                CompendiumCommandResults.Precondition(
                    context,
                    SurfaceMissingCode,
                    "No surface lies under ("
                        + x.ToString("R", CultureInfo.InvariantCulture)
                        + ", "
                        + z.ToString("R", CultureInfo.InvariantCulture)
                        + ") within the probe distance. The target cell may not be streamed in yet."
                )
            );
        }

        var found = surface.Value;
        _target.MoveCharacter(new OperatorPoint(x, found.Height + SurfaceClearance, z));

        return new(
            ControlCommandResult.Ok(
                new OperatorTeleportResult
                {
                    Position = _target.CharacterPosition,
                    SurfaceHeight = found.Height,
                    Surface = found.Name,
                }
            )
        );
    }
}
