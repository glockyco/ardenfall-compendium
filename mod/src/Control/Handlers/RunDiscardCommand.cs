using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunDiscardCommand : IControlCommandHandler
{
    private readonly CompendiumRunManager _runs;

    public RunDiscardCommand(CompendiumRunManager runs)
    {
        _runs = runs;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "run.discard",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: true,
        argsSchema: CompendiumCommandSchemas.AnyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("runIdRequired", "runId is required."));

        _runs.Discard(runId);
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(new JObject
        {
            ["runId"] = runId,
            ["discarded"] = true,
        }));
    }
}
