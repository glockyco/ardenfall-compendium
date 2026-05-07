using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control.Handlers;

public sealed class RunStatusCommand : IControlCommandHandler
{
    private readonly ArchiveRunManager _runs;

    public RunStatusCommand(ArchiveRunManager runs)
    {
        _runs = runs;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "run.status",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: ArchiveCommandSchemas.AnyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Validation("runIdRequired", "runId is required."));
        if (!_runs.TryGet(runId, out var run))
            return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Validation("unknownRun", $"Unknown run '{runId}'."));

        return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Ok(new JObject
        {
            ["runId"] = run.RunId,
            ["state"] = run.State,
            ["counts"] = JObject.FromObject(run.Counts),
            ["finalized"] = run.Finalized,
            ["workspaceDir"] = run.WorkspaceDir,
            ["publishedDir"] = run.PublishedDir,
        }));
    }
}
