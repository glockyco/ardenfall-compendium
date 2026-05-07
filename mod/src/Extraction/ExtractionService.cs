using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Emit;
using ArdenfallArchives.Entities.Item;
using PreflightRunner = ArdenfallArchives.Preflight.Preflight;

namespace ArdenfallArchives.Extraction;

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
            var extractor = new ItemExtractor();
            var rows = extractor.Walk().ToList();
            var envelope = new ItemSnapshotEnvelope { Rows = rows };
            var path = writer.WriteEntityFile(staging, "item", envelope);
            var json = File.ReadAllText(path);

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
                contentHashes: new Dictionary<string, string> { ["items.json"] = ManifestBuilder.Sha256Hex(json) },
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
