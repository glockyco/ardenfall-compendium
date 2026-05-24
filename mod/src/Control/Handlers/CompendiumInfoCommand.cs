using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class CompendiumInfoCommand : IControlCommandHandler<EmptyArgs, CompendiumInfoResult>
{
    public string Name => "compendium.info";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<CompendiumInfoResult>> ExecuteAsync(
        ControlCommandContext<CompendiumInfoResult> context,
        EmptyArgs args,
        CancellationToken cancellationToken
    ) =>
        new(
            ControlCommandResult.Ok(
                new CompendiumInfoResult
                {
                    ApiVersion = 1,
                    ExtractorVersion = Plugin.Version,
                    GameVersion = Game.GameInfo.Version,
                    SupportedEntities = new[] { "item" },
                }
            )
        );
}
