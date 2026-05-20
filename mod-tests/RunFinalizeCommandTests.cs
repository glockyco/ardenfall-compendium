using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Extraction;
using ArdenfallCompendium.MasterTooltip;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class RunFinalizeCommandTests
{
    private static readonly FakeStatTypeExtractionCache EmptyStatTypes = new(System.Array.Empty<StatTypeSnapshotRow>());

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
        var command = new RunFinalizeCommand(runs, cache, FakeMasterTooltipSource.Default, EmptyStatTypes);

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


    [Fact]
    public async Task WritesAssetManifestArtifactAndHash()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-assets-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var assetPlan = new ItemIconAssetPlan();
        assetPlan.Manifest.ItemIconMetadata.Add(new ItemIconMetadataEntry
        {
            EntityId = "item",
            RowId = "item-a",
            DisplayIconColor = new AssetColorSnapshot(),
        });
        var command = new RunFinalizeCommand(runs, new FakeItemExtractionCache(System.Array.Empty<Diagnostic>(), assetPlan), FakeMasterTooltipSource.Default, EmptyStatTypes);

        var result = await command.ExecuteAsync(null!, new JObject { ["runId"] = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Result["manifestPath"]!.Value<string>()!;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
        Assert.True(File.Exists(assetManifestPath));
        var assetManifest = JsonConvert.DeserializeObject<AssetManifest>(File.ReadAllText(assetManifestPath), JsonSettings.Default)!;
        Assert.Empty(assetManifest.Assets);
        Assert.Single(assetManifest.ItemIconMetadata);
        Assert.Contains(result.Artifacts, artifact => artifact.LogicalName == "asset-manifest");
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(assetManifestPath)), manifest.Hashes["asset-manifest.json"]);
    }

    [Fact]
    public async Task WritesMasterTooltipArtifactAndHash()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-master-tooltip-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var source = FakeMasterTooltipSource.Default;
        var command = new RunFinalizeCommand(runs, new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()), source, EmptyStatTypes);

        var result = await command.ExecuteAsync(null!, new JObject { ["runId"] = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Result["manifestPath"]!.Value<string>()!;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var masterTooltipPath = Path.Combine(publishedDir, "master-tooltip.json");
        Assert.True(File.Exists(masterTooltipPath));
        var snapshot = JsonConvert.DeserializeObject<MasterTooltipVocabularySnapshot>(File.ReadAllText(masterTooltipPath), JsonSettings.Default)!;
        Assert.Equal(2, snapshot.SchemaVersion);
        Assert.Equal("positive", snapshot.TooltipColors["p"].Text);
        Assert.Contains(result.Artifacts, artifact => artifact.LogicalName == "master-tooltip");
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(masterTooltipPath)), manifest.Hashes["master-tooltip.json"]);
    }

    [Fact]
    public async Task WritesStatTypeArtifactAndHash()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-stat-types-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var statAssetPlan = new ItemIconAssetPlan();
        statAssetPlan.Manifest.Assets.Add(new AssetManifestEntry
        {
            EntityId = "stat-type",
            RowId = "stat-strength",
            Slot = "iconRef",
            Kind = "image",
            PngHash = "a",
            SourcePath = "assets/stat-type/a.png",
        });
        var statTypes = new FakeStatTypeExtractionCache(new[]
        {
            new StatTypeSnapshotRow
            {
                Id = "stat-strength",
                Fields = new StatTypeSnapshot(
                    Id: "stat-strength",
                    IsAttribute: true,
                    StatName: "Strength",
                    IconRef: null,
                    IconColor: new AssetColorSnapshot(),
                    StatDescription: "Raw power.",
                    LongStatDescription: "Raw power. Affects melee damage.",
                    Affects: new List<string> { "melee-damage" },
                    SkillAffects: new List<string>()),
            },
        }, statAssetPlan);
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            statTypes);

        var result = await command.ExecuteAsync(null!, new JObject { ["runId"] = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Result["manifestPath"]!.Value<string>()!;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var statTypesPath = Path.Combine(publishedDir, "stat-types.json");
        Assert.True(File.Exists(statTypesPath));
        var envelope = JsonConvert.DeserializeObject<StatTypeSnapshotEnvelope>(File.ReadAllText(statTypesPath), JsonSettings.Default)!;
        Assert.Single(envelope.Rows);
        Assert.Equal("Strength", envelope.Rows[0].Fields.StatName);
        Assert.Contains(result.Artifacts, artifact => artifact.LogicalName == "stat-types");
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
        var assetManifest = JsonConvert.DeserializeObject<AssetManifest>(File.ReadAllText(assetManifestPath), JsonSettings.Default)!;
        Assert.Contains(assetManifest.Assets, asset => asset.EntityId == "stat-type" && asset.RowId == "stat-strength" && asset.Slot == "iconRef");
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(statTypesPath)), manifest.Hashes["stat-types.json"]);
        Assert.Equal(1, manifest.Counts["stat-type"]);
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
        private readonly ItemIconAssetPlan _assetPlan;

        public FakeItemExtractionCache(IReadOnlyList<Diagnostic> diagnostics, ItemIconAssetPlan? assetPlan = null)
        {
            _diagnostics = diagnostics;
            _assetPlan = assetPlan ?? new ItemIconAssetPlan();
        }

        public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run) => new List<ItemSnapshotRow>();

        public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => _assetPlan;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => _diagnostics;
    }

    private sealed class FakeStatTypeExtractionCache : IStatTypeExtractionCache
    {
        private readonly IReadOnlyList<StatTypeSnapshotRow> _rows;
        private readonly ItemIconAssetPlan _assetPlan;

        public FakeStatTypeExtractionCache(IReadOnlyList<StatTypeSnapshotRow> rows, ItemIconAssetPlan? assetPlan = null)
        {
            _rows = rows;
            _assetPlan = assetPlan ?? new ItemIconAssetPlan();
        }

        public IReadOnlyList<StatTypeSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => _assetPlan;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => System.Array.Empty<Diagnostic>();
    }

    private sealed class FakeMasterTooltipSource : IMasterTooltipSnapshotSource
    {
        public static readonly FakeMasterTooltipSource Default = new();

        public MasterTooltipVocabularySnapshot BuildSnapshot() => new()
        {
            SchemaVersion = 2,
            TooltipCodes = new Dictionary<string, string> { ["stamina"] = "Stamina" },
            TooltipColors = new Dictionary<string, MasterTooltipColorTokenSnapshot>
            {
                ["p"] = new() { Color = "#6FCF6F", Text = "positive" },
            },
            TooltipTargetColor = new AssetColorSnapshot(),
            TooltipDurationColor = new AssetColorSnapshot(),
            PositiveColor = new AssetColorSnapshot { R = 0.43f, G = 0.81f, B = 0.43f, A = 1f },
            NegativeColor = new AssetColorSnapshot { R = 0.95f, G = 0.36f, B = 0.36f, A = 1f },
            SpellSubEffectColor = new AssetColorSnapshot { R = 0.8f, G = 0.8f, B = 0.8f, A = 1f },
            EnchantmentItemColor = new AssetColorSnapshot { R = 0.55f, G = 0.78f, B = 0.85f, A = 1f },
            PrimarySpellTooltip = "<b>{0}</b>\n{1}",
            SecondarySpellTooltip = "<b>Secondary:</b> {0}\n{1}",
            UnmetSkillMessage = "You lack the required skill: {0}",
            BrokenDurabilityMessage = "This item is broken.",
            RuinedDurabilityMessage = "This item is ruined.",
            StatBookMessage = "Reading this grants {0}.",
            TermSetColors = new List<MasterTooltipTermSetColorSnapshot>(),
            GlobalTermSets = new List<MasterTooltipTermSetSnapshot>(),
            TermColorMatch = "\\b({0})\\b",
            PotionRecipeDescription = "Learn the potion recipe {0}.",
            AllAttributes = new List<string> { "fixture-strength" },
            AllSkills = new List<string> { "fixture-heavy-armor" },
            AllTraits = new List<string>(),
        };
    }
}
