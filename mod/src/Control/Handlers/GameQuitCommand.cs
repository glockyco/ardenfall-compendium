using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace ArdenfallArchives.Control.Handlers;

public sealed class GameQuitCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "game.quit",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: true,
        argsSchema: ArchiveCommandSchemas.EmptyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        Application.Quit();
        return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Ok(new JObject { ["quitting"] = true }));
    }
}
