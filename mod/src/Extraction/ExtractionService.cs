using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Extraction;

public interface IExtractionCache
{
    /// Terminal runs release every per-run row, diagnostic, and Unity asset-plan reference.
    void Evict(CompendiumRun run);
}

/// Extractors use fatal diagnostics for missing row identity, diagnostic severity for optional
/// data or malformed row fields, and never omit malformed input without naming its row.
public sealed class ExtractionService
{
    public ExtractionResult ExtractAll(ExtractionRequest request)
    {
        var preflight = PreflightRunner.Run();
        var result = new ExtractionResult { Preflight = preflight };
        if (!preflight.Passed)
            return result;

        var writer = new SnapshotWriter(request.OutputBaseDir);
        var staging = writer.BeginStaging(request.GameVersion);
        try
        {
            var assetPlan = new IconAssetPlan();
            var extractor = new ItemExtractor(new BuiltLookupTableItemAssetSource(), assetPlan);
            var rows = extractor.Walk().ToList();
            var envelope = new ItemSnapshotEnvelope { Rows = rows };
            var path = writer.WriteEntityFile(staging, "item", envelope);
            var json = File.ReadAllText(path);
            new IconAssetManifestWriter(new SpriteAssetExporter()).WriteSlots(staging, assetPlan);
            writer.WriteAssetManifest(staging, assetPlan.Manifest);
            var assetManifestJson = File.ReadAllText(Path.Combine(staging, "asset-manifest.json"));

            var totals = new DiagnosticTotals();
            foreach (var diagnostic in extractor.Diagnostics)
            {
                if (diagnostic.Severity == "fatal") totals.Fatal++;
                else totals.Diagnostic++;
                result.Diagnostics.Add(diagnostic);
            }

            var manifest = ManifestBuilder.Build(
                preflight,
                counts: new Dictionary<string, int> { ["item"] = rows.Count },
                diagnostics: totals,
                contentHashes: new Dictionary<string, string>
                {
                    ["items.json"] = ManifestBuilder.Sha256Hex(json),
                    ["asset-manifest.json"] = ManifestBuilder.Sha256Hex(assetManifestJson),
                },
                extractorVersion: Plugin.Version,
                gameVersion: request.GameVersion);
            writer.WriteManifest(staging, manifest);

            result.PublishedDir = writer.Publish(staging, request.GameVersion);
            result.ItemCount = rows.Count;
            result.DiagnosticCount = extractor.Diagnostics.Count;
            result.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            writer.DiscardStaging(staging);
            result.Diagnostics.Add(new Diagnostic
            {
                Severity = "fatal",
                Code = "extractionFailed",
                Field = "snapshot",
                Message = ex.Message,
            });
            return result;
        }
    }
}
