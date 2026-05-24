using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class CompendiumPreflightCommand
    : IControlCommandHandler<EmptyArgs, CompendiumPreflightResult>
{
    public string Name => "compendium.preflight";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Synchronous;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<CompendiumPreflightResult>> ExecuteAsync(
        ControlCommandContext context,
        EmptyArgs args,
        CancellationToken cancellationToken
    )
    {
        var report = PreflightRunner.Run();
        return new(
            ControlCommandResult.Ok(
                new CompendiumPreflightResult
                {
                    Ready = report.Passed,
                    Passed = report.Passed,
                    CompletedAt = report.CompletedAt,
                    Checks = report.Checks,
                }
            )
        );
    }
}
