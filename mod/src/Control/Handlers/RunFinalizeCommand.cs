using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.ItemCategory;
using ArdenfallCompendium.Entities.ItemTag;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Extraction;
using ArdenfallCompendium.MasterTooltip;
using HotRepl.Control;
using HotRepl.Control.Artifacts;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunFinalizeCommand : IControlCommandHandler<RunIdArgs, RunFinalizeResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;
    private readonly IStatTypeExtractionCache _statTypes;
    private readonly IItemCategoryExtractionCache _itemCategories;
    private readonly IItemTagExtractionCache _itemTags;
    private readonly IMasterTooltipSnapshotSource _masterTooltip;
    private readonly Func<PreflightReport> _preflight;

    public RunFinalizeCommand(
        CompendiumRunManager runs,
        IItemExtractionCache items,
        IMasterTooltipSnapshotSource? masterTooltip = null,
        IStatTypeExtractionCache? statTypes = null,
        IItemCategoryExtractionCache? itemCategories = null,
        IItemTagExtractionCache? itemTags = null,
        Func<PreflightReport>? preflight = null
    )
    {
        _runs = runs;
        _items = items;
        _statTypes = statTypes ?? new StatTypeExtractionService(new BuiltLookupTableStatTypeAssetSource());
        _itemCategories = itemCategories ?? new ItemCategoryExtractionService(new BuiltLookupTableItemCategoryAssetSource());
        _itemTags = itemTags ?? new ItemTagExtractionService(new BuiltLookupTableItemTagAssetSource());
        _masterTooltip = masterTooltip ?? RuntimeMasterTooltipSnapshotSource.Instance;
        _preflight = preflight ?? PreflightRunner.Run;
    }

    public string Name => "run.finalize";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Synchronous;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<RunFinalizeResult>> ExecuteAsync(
        ControlCommandContext context,
        RunIdArgs args,
        CancellationToken cancellationToken
    )
    {
        var runIdValidation = CompendiumCommandResults.RequiredString<RunFinalizeResult>(
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return new(runIdValidation);
        if (!_runs.TryGet(args.RunId, out var run))
            return new(
                CompendiumCommandResults.Validation<RunFinalizeResult>(
                    "unknownRun",
                    $"Unknown run '{args.RunId}'."
                )
            );
        if (run.Finalized)
            return new(
                CompendiumCommandResults.Precondition<RunFinalizeResult>(
                    "runFinalized",
                    $"Run '{args.RunId}' is already finalized."
                )
            );

        var preflight = _preflight();
        if (!preflight.Passed)
            return new(
                CompendiumCommandResults.Precondition<RunFinalizeResult>(
                    "preflightFailed",
                    "Preflight failed; no snapshot was written.",
                    JObject.FromObject(preflight)
                )
            );

        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        var chunkValidation = ReadPlannedItemChunks(
            run,
            chunksDir,
            out var rows,
            out var diagnosticTotals,
            out var diagnostics
        );
        if (chunkValidation != null) return new(chunkValidation);

        var snapshotsRoot = Path.Combine(run.OutputBaseDir, "snapshots");
        var publishedDir = Path.Combine(snapshotsRoot, $"{run.GameVersion}-{run.RunId}");
        if (Directory.Exists(publishedDir))
            return new(
                CompendiumCommandResults.Precondition<RunFinalizeResult>(
                    "snapshotExists",
                    $"Snapshot directory already exists: {publishedDir}"
                )
            );

        Directory.CreateDirectory(snapshotsRoot);
        var stagingDir = Path.Combine(snapshotsRoot, $".staging-{run.GameVersion}-{run.RunId}");
        if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, recursive: true);
        Directory.CreateDirectory(stagingDir);

        try
        {
            var hashes = new Dictionary<string, string>();

            var itemEnvelope = new ItemSnapshotEnvelope { Rows = rows };
            WriteJson(stagingDir, "items.json", itemEnvelope, hashes);

            var statTypeRows = _statTypes.GetOrExtract(run);
            var statTypeAssetPlan = _statTypes.GetAssetPlan(run);
            var itemCategoryRows = _itemCategories.GetOrExtract(run);
            var itemCategoryAssetPlan = _itemCategories.GetAssetPlan(run);
            var itemTagRows = _itemTags.GetOrExtract(run);

            var assetPlan = _items.GetAssetPlan(run);
            var assetWriter = new ItemAssetManifestWriter(new SpriteAssetExporter());
            assetWriter.WriteSlots(stagingDir, assetPlan);
            assetWriter.WriteSlots(stagingDir, statTypeAssetPlan);
            assetWriter.WriteSlots(stagingDir, itemCategoryAssetPlan);
            assetPlan.Manifest.Assets.AddRange(statTypeAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(statTypeAssetPlan.Manifest.ItemIconMetadata);
            assetPlan.Manifest.Assets.AddRange(itemCategoryAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(itemCategoryAssetPlan.Manifest.ItemIconMetadata);
            WriteJson(stagingDir, "asset-manifest.json", assetPlan.Manifest, hashes);

            var masterTooltip = _masterTooltip.BuildSnapshot();
            WriteJson(stagingDir, "master-tooltip.json", masterTooltip, hashes);

            var statTypeEnvelope = new StatTypeSnapshotEnvelope { Rows = statTypeRows.ToList() };
            WriteJson(stagingDir, "stat-types.json", statTypeEnvelope, hashes);
            var itemCategoryEnvelope = new ItemCategorySnapshotEnvelope { Rows = itemCategoryRows.ToList() };
            WriteJson(stagingDir, "item-categories.json", itemCategoryEnvelope, hashes);
            var itemTagEnvelope = new ItemTagSnapshotEnvelope { Rows = itemTagRows.ToList() };
            WriteJson(stagingDir, "item-tags.json", itemTagEnvelope, hashes);

            foreach (var diagnostic in _items.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _statTypes.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _itemCategories.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _itemTags.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }

            if (diagnostics.Count > 0)
            {
                WriteJson(stagingDir, "diagnostics.json", diagnostics, hashes);
            }

            var counts = new Dictionary<string, int>
            {
                ["item"] = rows.Count,
                ["stat-type"] = statTypeRows.Count,
                ["item-category"] = itemCategoryRows.Count,
                ["item-tag"] = itemTagRows.Count,
            };
            var manifest = ManifestBuilder.Build(
                preflight,
                counts: counts,
                diagnostics: diagnosticTotals,
                contentHashes: hashes,
                extractorVersion: Plugin.Version,
                gameVersion: run.GameVersion,
                buildIdentifier: run.RunId
            );
            var manifestJson = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
            File.WriteAllText(Path.Combine(stagingDir, "manifest.json"), manifestJson);
            var manifestHash = ManifestBuilder.Sha256Hex(manifestJson);

            Directory.Move(stagingDir, publishedDir);

            run.PublishedDir = publishedDir;
            run.State = "finalized";
            run.Counts["item"] = rows.Count;
            run.Counts["stat-type"] = statTypeRows.Count;
            run.Counts["item-category"] = itemCategoryRows.Count;
            run.Counts["item-tag"] = itemTagRows.Count;
            _runs.Save(run);

            var manifestPath = Path.Combine(publishedDir, "manifest.json");
            var result = new RunFinalizeResult
            {
                RunId = run.RunId,
                PublishedDir = publishedDir,
                ManifestPath = manifestPath,
            };
            var artifacts = new Dictionary<string, ArtifactRef>(StringComparer.Ordinal)
            {
                ["manifest"] = CompendiumCommandResults.FileArtifact("manifest", manifestPath, "application/json", manifestHash),
                ["items"] = CompendiumCommandResults.FileArtifact("items", Path.Combine(publishedDir, "items.json"), "application/json", hashes["items.json"]),
                ["asset-manifest"] = CompendiumCommandResults.FileArtifact("asset-manifest", Path.Combine(publishedDir, "asset-manifest.json"), "application/json", hashes["asset-manifest.json"]),
                ["master-tooltip"] = CompendiumCommandResults.FileArtifact("master-tooltip", Path.Combine(publishedDir, "master-tooltip.json"), "application/json", hashes["master-tooltip.json"]),
                ["stat-types"] = CompendiumCommandResults.FileArtifact("stat-types", Path.Combine(publishedDir, "stat-types.json"), "application/json", hashes["stat-types.json"]),
                ["item-categories"] = CompendiumCommandResults.FileArtifact("item-categories", Path.Combine(publishedDir, "item-categories.json"), "application/json", hashes["item-categories.json"]),
                ["item-tags"] = CompendiumCommandResults.FileArtifact("item-tags", Path.Combine(publishedDir, "item-tags.json"), "application/json", hashes["item-tags.json"]),
            };
            if (hashes.TryGetValue("diagnostics.json", out var diagnosticsHash))
            {
                artifacts["diagnostics"] = CompendiumCommandResults.FileArtifact(
                    "diagnostics",
                    Path.Combine(publishedDir, "diagnostics.json"),
                    "application/json",
                    diagnosticsHash
                );
            }

            return new(ControlCommandResult.Ok(result, artifacts));
        }
        catch
        {
            if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, recursive: true);
            throw;
        }
    }

    private static ControlCommandResult<RunFinalizeResult>? ReadPlannedItemChunks(
        CompendiumRun run,
        string chunksDir,
        out List<ItemSnapshotRow> rows,
        out DiagnosticTotals diagnosticTotals,
        out List<JObject> diagnostics
    )
    {
        rows = new List<ItemSnapshotRow>();
        diagnosticTotals = new DiagnosticTotals();
        diagnostics = new List<JObject>();

        if (!run.TryGetEntityPlan("item", out var plan))
            return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                "planMissing",
                $"Run '{run.RunId}' does not have an item plan."
            );
        if (plan.BatchSize <= 0)
            return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                "planInvalid",
                "Item plan batchSize must be greater than zero."
            );
        if (!Directory.Exists(chunksDir))
            return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                "chunksMissing",
                "No item chunks were exported."
            );

        var expectedOffsets = plan.ExpectedOffsets().ToList();
        var missingOffsets = expectedOffsets
            .Where(offset => !plan.IsComplete(offset) || !File.Exists(ChunkPath(chunksDir, offset)))
            .ToList();
        if (missingOffsets.Count > 0)
            return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                "chunksIncomplete",
                $"Missing item chunks at offsets: {string.Join(", ", missingOffsets)}.",
                new JObject { ["missingOffsets"] = JArray.FromObject(missingOffsets) }
            );

        foreach (var offset in expectedOffsets)
        {
            var chunkPath = ChunkPath(chunksDir, offset);
            var json = File.ReadAllText(chunkPath);
            var envelope = JsonConvert.DeserializeObject<ItemSnapshotEnvelope>(json, JsonSettings.Default);
            if (envelope?.Rows == null)
                return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                    "chunkInvalid",
                    $"Item chunk is invalid: {chunkPath}"
                );

            var expectedWritten = Math.Min(plan.BatchSize, plan.Total - offset);
            if (envelope.Rows.Count != expectedWritten)
                return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                    "chunkRowCountMismatch",
                    $"Item chunk at offset {offset} contains {envelope.Rows.Count} rows; expected {expectedWritten}."
                );

            foreach (var row in envelope.Rows)
            {
                rows.Add(row);
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
        }

        if (rows.Count != plan.Total)
            return CompendiumCommandResults.Precondition<RunFinalizeResult>(
                "chunkRowCountMismatch",
                $"Item chunks contain {rows.Count} rows; expected {plan.Total}."
            );

        return null;
    }

    private static string ChunkPath(string chunksDir, int offset) =>
        Path.Combine(chunksDir, $"{offset:D6}.json");

    private static void WriteJson(string dir, string fileName, object value, IDictionary<string, string> hashes)
    {
        var json = JsonConvert.SerializeObject(value, JsonSettings.Default);
        File.WriteAllText(Path.Combine(dir, fileName), json);
        hashes[fileName] = ManifestBuilder.Sha256Hex(json);
    }

    private static void AddDiagnostic(
        DiagnosticTotals totals,
        List<JObject> sink,
        string? rowId,
        Diagnostic diagnostic
    )
    {
        if (string.Equals(diagnostic.Severity, "fatal", StringComparison.Ordinal)) totals.Fatal++;
        else totals.Diagnostic++;

        sink.Add(
            new JObject
            {
                ["rowId"] = rowId is null ? JValue.CreateNull() : rowId,
                ["severity"] = diagnostic.Severity,
                ["code"] = diagnostic.Code,
                ["field"] = diagnostic.Field,
                ["message"] = diagnostic.Message,
            }
        );
    }
}
