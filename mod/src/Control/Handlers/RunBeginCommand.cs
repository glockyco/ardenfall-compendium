using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunBeginCommand : IControlCommandHandler<RunBeginArgs, RunBeginResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly string _defaultOutputBaseDir;

    public RunBeginCommand(CompendiumRunManager runs, string defaultOutputBaseDir)
    {
        _runs = runs;
        _defaultOutputBaseDir = defaultOutputBaseDir;
    }

    public string Name => "run.begin";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<RunBeginResult>> ExecuteAsync(
        ControlCommandContext<RunBeginResult> context,
        RunBeginArgs args,
        CancellationToken cancellationToken
    )
    {
        var outputBaseDir = OptionalString(args.OutputBaseDir) ?? _defaultOutputBaseDir;
        if (string.IsNullOrWhiteSpace(outputBaseDir))
            return new(
                CompendiumCommandResults.Validation(
                    context,
                    "outputBaseDirRequired",
                    "outputBaseDir is required."
                )
            );

        var gameVersion = SanitizeSegment(OptionalString(args.GameVersion) ?? Game.GameInfo.SnapshotVersionSegment);
        var run = _runs.Begin(outputBaseDir, gameVersion);
        return new(
            ControlCommandResult.Ok(
                new RunBeginResult { RunId = run.RunId, WorkspaceDir = run.WorkspaceDir }
            )
        );
    }

    private static string? OptionalString(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

    private static string SanitizeSegment(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = new string(value.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
        return string.IsNullOrWhiteSpace(sanitized) ? "unknown" : sanitized;
    }
}
