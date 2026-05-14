using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Extraction;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class RunFinalizeCommandTests
{
    [Fact]
    public async Task AggregatesRowAndWalkerDiagnosticsIntoManifestAndDiagnosticsArtifact()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
            Diagnostics = new List<Diagnostic>
            {
                Diagnostic("diagnostic", "rowDiagnosticA"),
                Diagnostic("diagnostic", "rowDiagnosticB"),
            },
        });
        WriteChunk(run, "000100.json", new ItemSnapshotRow
        {
            Id = "item-b",
            Fields = new Dictionary<string, object?>(),
            Diagnostics = new List<Diagnostic> { Diagnostic("fatal", "rowFatal") },
        });
        var cache = new FakeItemExtractionCache(new[] { Diagnostic("diagnostic", "walkerDiagnostic") });
        var command = new RunFinalizeCommand(runs, cache);

        var result = await command.ExecuteAsync(null!, new JObject { ["runId"] = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Result["manifestPath"]!.Value<string>()!;
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(1, manifest.Diagnostics.Fatal);
        Assert.Equal(3, manifest.Diagnostics.Diagnostic);

        var diagnosticsPath = Path.Combine(Path.GetDirectoryName(manifestPath)!, "diagnostics.json");
        Assert.True(File.Exists(diagnosticsPath));
        var diagnostics = JArray.Parse(File.ReadAllText(diagnosticsPath));
        Assert.Equal(4, diagnostics.Count);
        Assert.Contains(diagnostics, d => d["rowId"]?.Value<string>() == "item-a" && d["code"]?.Value<string>() == "rowDiagnosticA");
        Assert.Contains(diagnostics, d => d["rowId"]!.Type == JTokenType.Null && d["code"]?.Value<string>() == "walkerDiagnostic");
    }

    private static Diagnostic Diagnostic(string severity, string code) => new()
    {
        Severity = severity,
        Code = code,
        Field = "field",
        Message = code,
    };

    private static void WriteChunk(CompendiumRun run, string fileName, ItemSnapshotRow row)
    {
        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        Directory.CreateDirectory(chunksDir);
        var json = JsonConvert.SerializeObject(new ItemSnapshotEnvelope { Rows = new List<ItemSnapshotRow> { row } }, JsonSettings.Default);
        File.WriteAllText(Path.Combine(chunksDir, fileName), json);
    }

    private sealed class FakeItemExtractionCache : IItemExtractionCache
    {
        private readonly IReadOnlyList<Diagnostic> _diagnostics;

        public FakeItemExtractionCache(IReadOnlyList<Diagnostic> diagnostics)
        {
            _diagnostics = diagnostics;
        }

        public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run) => new List<ItemSnapshotRow>();

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => _diagnostics;
    }
}
