using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;
using UnityEngine;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class GameQuitCommand : IControlCommandHandler<EmptyArgs, GameQuitResult>
{
    public string Name => "game.quit";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Synchronous;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<GameQuitResult>> ExecuteAsync(
        ControlCommandContext context,
        EmptyArgs args,
        CancellationToken cancellationToken
    )
    {
        Application.Quit();
        return new(ControlCommandResult.Ok(new GameQuitResult { Quitting = true }));
    }
}
