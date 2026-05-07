using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control.Handlers;

public sealed class RunBeginCommand : IControlCommandHandler
{
    private readonly ArchiveRunManager _runs;
    private readonly string _defaultOutputBaseDir;

    public RunBeginCommand(ArchiveRunManager runs, string defaultOutputBaseDir)
    {
        _runs = runs;
        _defaultOutputBaseDir = defaultOutputBaseDir;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "run.begin",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: true,
        argsSchema: ArchiveCommandSchemas.AnyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var outputBaseDir = OptionalString(args, "outputBaseDir") ?? _defaultOutputBaseDir;
        if (string.IsNullOrWhiteSpace(outputBaseDir))
            return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Validation("outputBaseDirRequired", "outputBaseDir is required."));

        var gameVersion = SanitizeSegment(OptionalString(args, "gameVersion") ?? Game.GameInfo.SnapshotVersionSegment);
        var run = _runs.Begin(outputBaseDir, gameVersion);
        return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Ok(new JObject
        {
            ["runId"] = run.RunId,
            ["workspaceDir"] = run.WorkspaceDir,
        }));
    }

    private static string? OptionalString(JObject args, string name)
    {
        var value = args[name]?.Value<string>();
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string SanitizeSegment(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = new string(value.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
        return string.IsNullOrWhiteSpace(sanitized) ? "unknown" : sanitized;
    }
}
