using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class GameQuitCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "game.quit",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: true,
        argsSchema: CompendiumCommandSchemas.EmptyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        Application.Quit();
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(new JObject { ["quitting"] = true }));
    }
}
