using System;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PreflightRunner = ArdenfallArchives.Preflight.Preflight;

namespace ArdenfallArchives.Control.Handlers;

public sealed class ArchivePreflightCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "archive.preflight",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: ArchiveCommandSchemas.EmptyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var report = PreflightRunner.Run();
        var result = JObject.FromObject(report, JsonSerializer.Create(Emit.JsonSettings.Default));
        result["ready"] = report.Passed;
        return new ValueTask<ControlCommandResult>(new ControlCommandResult(result, Array.Empty<HotRepl.Control.Artifacts.ArtifactRef>(), Array.Empty<ControlCommandError>()));
    }
}
