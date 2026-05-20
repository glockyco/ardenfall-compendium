using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Extraction;
using ArdenfallCompendium.MasterTooltip;
using HotRepl.Control;
using HotRepl.Control.Artifacts;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunFinalizeCommand : IControlCommandHandler
{
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;
    private readonly IStatTypeExtractionCache _statTypes;
    private readonly IMasterTooltipSnapshotSource _masterTooltip;

    public RunFinalizeCommand(
        CompendiumRunManager runs,
        IItemExtractionCache items,
        IMasterTooltipSnapshotSource? masterTooltip = null,
        IStatTypeExtractionCache? statTypes = null)
    {
        _runs = runs;
        _items = items;
        _statTypes = statTypes ?? new StatTypeExtractionService(new BuiltLookupTableStatTypeAssetSource());
        _masterTooltip = masterTooltip ?? RuntimeMasterTooltipSnapshotSource.Instance;
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
        var diagnosticTotals = new DiagnosticTotals();
        var diagnostics = new List<JObject>();
        foreach (var chunk in Directory.GetFiles(chunksDir, "*.json").OrderBy(p => p))
        {
            var json = File.ReadAllText(chunk);
            var envelope = JsonConvert.DeserializeObject<ItemSnapshotEnvelope>(json, JsonSettings.Default);
            if (envelope?.Rows == null) continue;
            foreach (var row in envelope.Rows)
            {
                rows.Add(row);
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
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


        var assetPlan = _items.GetAssetPlan(run);
        new ItemAssetManifestWriter(new SpriteAssetExporter()).WriteSlots(publishedDir, assetPlan);
        var assetManifest = assetPlan.Manifest;
        var assetManifestJson = JsonConvert.SerializeObject(assetManifest, JsonSettings.Default);
        var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
        File.WriteAllText(assetManifestPath, assetManifestJson);
        var assetManifestHash = ManifestBuilder.Sha256Hex(assetManifestJson);

        var masterTooltip = _masterTooltip.BuildSnapshot();
        var masterTooltipJson = JsonConvert.SerializeObject(masterTooltip, JsonSettings.Default);
        var masterTooltipPath = Path.Combine(publishedDir, "master-tooltip.json");
        File.WriteAllText(masterTooltipPath, masterTooltipJson);
        var masterTooltipHash = ManifestBuilder.Sha256Hex(masterTooltipJson);

        var statTypeRows = _statTypes.GetOrExtract(run);
        var statTypeEnvelope = new StatTypeSnapshotEnvelope { Rows = statTypeRows.ToList() };
        var statTypesJson = JsonConvert.SerializeObject(statTypeEnvelope, JsonSettings.Default);
        var statTypesPath = Path.Combine(publishedDir, "stat-types.json");
        File.WriteAllText(statTypesPath, statTypesJson);
        var statTypesHash = ManifestBuilder.Sha256Hex(statTypesJson);
        foreach (var diagnostic in _items.GetWalkerDiagnostics(run))
        {
            AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
        }
        foreach (var diagnostic in _statTypes.GetWalkerDiagnostics(run))
        {
            AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
        }

        var hashes = new Dictionary<string, string>
        {
            ["items.json"] = itemHash,
            ["asset-manifest.json"] = assetManifestHash,
            ["master-tooltip.json"] = masterTooltipHash,
            ["stat-types.json"] = statTypesHash,
        };
        string? diagnosticsPath = null;
        string? diagnosticsHash = null;
        if (diagnostics.Count > 0)
        {
            var diagnosticsJson = JsonConvert.SerializeObject(diagnostics, JsonSettings.Default);
            diagnosticsPath = Path.Combine(publishedDir, "diagnostics.json");
            File.WriteAllText(diagnosticsPath, diagnosticsJson);
            diagnosticsHash = ManifestBuilder.Sha256Hex(diagnosticsJson);
            hashes["diagnostics.json"] = diagnosticsHash;
        }

        var manifest = ManifestBuilder.Build(
            PreflightRunner.Run(),
            counts: new Dictionary<string, int> { ["item"] = rows.Count, ["stat-type"] = statTypeRows.Count },
            diagnostics: diagnosticTotals,
            contentHashes: hashes,
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
        run.Counts["stat-type"] = statTypeRows.Count;

        var result = new JObject
        {
            ["runId"] = run.RunId,
            ["publishedDir"] = publishedDir,
            ["manifestPath"] = manifestPath,
        };
        var artifacts = new List<ArtifactRef>
        {
            CompendiumCommandResults.FileArtifact("manifest", manifestPath, "application/json", manifestHash),
            CompendiumCommandResults.FileArtifact("items", itemsPath, "application/json", itemHash),
            CompendiumCommandResults.FileArtifact("asset-manifest", assetManifestPath, "application/json", assetManifestHash),
            CompendiumCommandResults.FileArtifact("master-tooltip", masterTooltipPath, "application/json", masterTooltipHash),
            CompendiumCommandResults.FileArtifact("stat-types", statTypesPath, "application/json", statTypesHash),
        };
        if (diagnosticsPath is not null && diagnosticsHash is not null)
        {
            artifacts.Add(CompendiumCommandResults.FileArtifact("diagnostics", diagnosticsPath, "application/json", diagnosticsHash));
        }
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(result, artifacts.ToArray()));
    }

    private static void AddDiagnostic(DiagnosticTotals totals, List<JObject> sink, string? rowId, Diagnostic diagnostic)
    {
        if (diagnostic.Severity == "fatal") totals.Fatal++;
        else totals.Diagnostic++;

        sink.Add(new JObject
        {
            ["rowId"] = rowId is null ? JValue.CreateNull() : rowId,
            ["severity"] = diagnostic.Severity,
            ["code"] = diagnostic.Code,
            ["field"] = diagnostic.Field,
            ["message"] = diagnostic.Message,
        });
    }
}
