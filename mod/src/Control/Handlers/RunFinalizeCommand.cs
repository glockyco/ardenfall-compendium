using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using HotRepl.Control;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunFinalizeCommand : IControlCommandHandler
{
    private readonly CompendiumRunManager _runs;

    public RunFinalizeCommand(CompendiumRunManager runs)
    {
        _runs = runs;
    }

    public ControlCommandDescriptor Descriptor { get; } = new(
        "run.finalize",
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
        if (!_runs.TryGet(runId, out var run))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("unknownRun", $"Unknown run '{runId}'."));
        if (run.Finalized)
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Precondition("runFinalized", $"Run '{runId}' is already finalized."));

        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        if (!Directory.Exists(chunksDir))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Precondition("chunksMissing", "No item chunks were exported."));

        var rows = new List<ItemSnapshotRow>();
        foreach (var chunk in Directory.GetFiles(chunksDir, "*.json").OrderBy(p => p))
        {
            var json = File.ReadAllText(chunk);
            var envelope = JsonConvert.DeserializeObject<ItemSnapshotEnvelope>(json, JsonSettings.Default);
            if (envelope?.Rows != null) rows.AddRange(envelope.Rows);
        }

        var publishedDir = Path.Combine(run.OutputBaseDir, "snapshots", $"{run.GameVersion}-{run.RunId}");
        if (Directory.Exists(publishedDir))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Precondition("snapshotExists", $"Snapshot directory already exists: {publishedDir}"));
        Directory.CreateDirectory(publishedDir);

        var itemEnvelope = new ItemSnapshotEnvelope { Rows = rows };
        var itemsJson = JsonConvert.SerializeObject(itemEnvelope, JsonSettings.Default);
        var itemsPath = Path.Combine(publishedDir, "items.json");
        File.WriteAllText(itemsPath, itemsJson);
        var itemHash = ManifestBuilder.Sha256Hex(itemsJson);

        var manifest = ManifestBuilder.Build(
            PreflightRunner.Run(),
            counts: new Dictionary<string, int> { ["item"] = rows.Count },
            diagnostics: new DiagnosticTotals(),
            contentHashes: new Dictionary<string, string> { ["items.json"] = itemHash },
            extractorVersion: Plugin.Version,
            gameVersion: run.GameVersion,
            buildIdentifier: run.RunId);
        var manifestJson = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
        var manifestPath = Path.Combine(publishedDir, "manifest.json");
        File.WriteAllText(manifestPath, manifestJson);
        var manifestHash = ManifestBuilder.Sha256Hex(manifestJson);

        run.PublishedDir = publishedDir;
        run.State = "finalized";
        run.Counts["item"] = rows.Count;

        var result = new JObject
        {
            ["runId"] = run.RunId,
            ["publishedDir"] = publishedDir,
            ["manifestPath"] = manifestPath,
        };
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(
            result,
            CompendiumCommandResults.FileArtifact("manifest", manifestPath, "application/json", manifestHash),
            CompendiumCommandResults.FileArtifact("items", itemsPath, "application/json", itemHash)));
    }
}
