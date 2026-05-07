using System;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class CompendiumInfoCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "compendium.info",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: CompendiumCommandSchemas.EmptyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var result = new JObject
        {
            ["apiVersion"] = 1,
            ["extractorVersion"] = Plugin.Version,
            ["gameVersion"] = Game.GameInfo.Version,
            ["supportedEntities"] = new JArray("item"),
        };
        return new ValueTask<ControlCommandResult>(new ControlCommandResult(result, Array.Empty<HotRepl.Control.Artifacts.ArtifactRef>(), Array.Empty<ControlCommandError>()));
    }
}
