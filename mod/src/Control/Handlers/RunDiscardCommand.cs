using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control.Handlers;

public sealed class RunDiscardCommand : IControlCommandHandler
{
    private readonly ArchiveRunManager _runs;

    public RunDiscardCommand(ArchiveRunManager runs)
    {
        _runs = runs;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "run.discard",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: true,
        argsSchema: ArchiveCommandSchemas.AnyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Validation("runIdRequired", "runId is required."));

        _runs.Discard(runId);
        return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Ok(new JObject
        {
            ["runId"] = runId,
            ["discarded"] = true,
        }));
    }
}
