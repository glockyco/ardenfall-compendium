using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Handlers;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Entities.ItemCategory;
using ArdenfallCompendium.Entities.ItemTag;
using ArdenfallCompendium.Entities.Location;
using ArdenfallCompendium.Entities.Portal;
using PublicItemTagSnapshot = ArdenfallCompendium.Entities.ItemTag.ItemTagSnapshot;
using ArdenfallCompendium.Extraction;
using ArdenfallCompendium.MasterTooltip;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class RunFinalizeCommandTests
{
    private static readonly FakeStatTypeExtractionCache EmptyStatTypes = new(System.Array.Empty<StatTypeSnapshotRow>());
    private static readonly FakeItemCategoryExtractionCache EmptyItemCategories = new(System.Array.Empty<ItemCategorySnapshotRow>());
    private static readonly FakeItemTagExtractionCache EmptyItemTags = new(System.Array.Empty<ItemTagSnapshotRow>());
    private static readonly FakeLocationExtractionCache EmptyLocations = new(System.Array.Empty<LocationSnapshotRow>());
    private static readonly FakePortalExtractionCache EmptyPortals = new(System.Array.Empty<PortalSnapshotRow>());

    [Fact]
    public async Task RejectsFailedPreflightBeforePublishing()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-preflight-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: FailingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Contains(result.Diagnostics, error => error.Code == "preflightFailed");
        Assert.False(Directory.Exists(Path.Combine(outputBaseDir, "snapshots")));
    }

    [Fact]
    public async Task RejectsMissingPlannedChunkBeforePublishing()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-missing-chunk-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        SetItemPlan(run, total: 2, batchSize: 1);
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        SetItemPlan(run, total: 2, batchSize: 1);
        run.MarkEntityChunkComplete("item", offset: 0, written: 1);
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Contains(result.Diagnostics, error => error.Code == "chunksIncomplete");
        Assert.False(Directory.Exists(Path.Combine(outputBaseDir, "snapshots", $"test-version-{run.RunId}")));
    }

    [Fact]
    public async Task DiscardsStagingWhenFinalizeFailsBeforePublish()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-atomic-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            new ThrowingMasterTooltipSource(),
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: PassingPreflight);

        await Assert.ThrowsAsync<System.InvalidOperationException>(() =>
            command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None).AsTask());

        var snapshotsDir = Path.Combine(outputBaseDir, "snapshots");
        Assert.False(Directory.Exists(Path.Combine(snapshotsDir, $"test-version-{run.RunId}")));
        Assert.Empty(Directory.Exists(snapshotsDir) ? Directory.GetDirectories(snapshotsDir) : System.Array.Empty<string>());
    }

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
        WriteChunk(run, "000001.json", new ItemSnapshotRow
        {
            Id = "item-b",
            Fields = new Dictionary<string, object?>(),
            Diagnostics = new List<Diagnostic> { Diagnostic("fatal", "rowFatal") },
        });
        var cache = new FakeItemExtractionCache(new[] { Diagnostic("diagnostic", "walkerDiagnostic") });
        var command = new RunFinalizeCommand(runs, cache, FakeMasterTooltipSource.Default, EmptyStatTypes, EmptyItemCategories, EmptyItemTags, EmptyLocations, EmptyPortals, preflight: PassingPreflight);
        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        Assert.Equal(1, cache.EvictionCount);
        Assert.False(runs.TryGet(run.RunId, out _));
        var manifestPath = result.Output!.ManifestPath;
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
    public async Task AggregatesLocationRowDiagnosticsIntoManifestAndDiagnosticsArtifact()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-location-diagnostics-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var locations = new FakeLocationExtractionCache(new[]
        {
            new LocationSnapshotRow
            {
                Id = "11111111.fixture-town",
                Fields = new LocationSnapshot(
                    Id: "11111111.fixture-town",
                    GameLocationId: "town",
                    Name: "Harbor Town",
                    Enabled: true,
                    MapRef: null,
                    MapId: null,
                    ShowOnMap: true,
                    ShowOnMapDebugOnly: false,
                    IconRef: null,
                    MapPosition: new LocationVector3Snapshot(12f, 3f, -8f),
                    AllowFastTravel: false,
                    FastTravelPosition: null,
                    DisplayOnEnterVolume: true,
                    Volumes: new List<LocationVolumeSnapshot>()),
                Diagnostics = new List<Diagnostic>
                {
                    Diagnostic("diagnostic", "locationMapMissing"),
                },
            },
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            locations,
            EmptyPortals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(0, manifest.Diagnostics.Fatal);
        Assert.Equal(1, manifest.Diagnostics.Diagnostic);

        var diagnosticsPath = Path.Combine(Path.GetDirectoryName(manifestPath)!, "diagnostics.json");
        Assert.True(File.Exists(diagnosticsPath));
        var diagnostics = JArray.Parse(File.ReadAllText(diagnosticsPath));
        Assert.Single(diagnostics);
        Assert.Contains(diagnostics, d => d["rowId"]?.Value<string>() == "11111111.fixture-town" && d["code"]?.Value<string>() == "locationMapMissing");
    }

    [Fact]
    public async Task EmitsFinalizeTimingArtifact()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-timing-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        Assert.Contains("finalize-timings", result.Artifacts.Keys);
        var publishedDir = Path.GetDirectoryName(result.Output!.ManifestPath)!;
        var timingPath = Path.Combine(publishedDir, "finalize-timings.json");
        Assert.True(File.Exists(timingPath));
        var artifactTimings = JArray.Parse(File.ReadAllText(timingPath));
        Assert.Contains(artifactTimings, timing => timing["phase"]?.Value<string>() == "chunks.read");
        Assert.All(artifactTimings, timing => Assert.True(timing["elapsedMs"]?.Value<long>() >= 0));

        var output = JObject.FromObject(result.Output!);
        var outputTimings = (JArray)output["timings"]!;
        Assert.Contains(outputTimings, timing => timing["phase"]?.Value<string>() == "publish");
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
        var command = new RunFinalizeCommand(runs, new FakeItemExtractionCache(System.Array.Empty<Diagnostic>(), assetPlan), FakeMasterTooltipSource.Default, EmptyStatTypes, EmptyItemCategories, EmptyItemTags, EmptyLocations, EmptyPortals, preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
        Assert.True(File.Exists(assetManifestPath));
        var assetManifest = JsonConvert.DeserializeObject<AssetManifest>(File.ReadAllText(assetManifestPath), JsonSettings.Default)!;
        Assert.Empty(assetManifest.Assets);
        Assert.Single(assetManifest.ItemIconMetadata);
        Assert.Contains("asset-manifest", result.Artifacts.Keys);
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
        var command = new RunFinalizeCommand(runs, new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()), source, EmptyStatTypes, EmptyItemCategories, EmptyItemTags, EmptyLocations, EmptyPortals, preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var masterTooltipPath = Path.Combine(publishedDir, "master-tooltip.json");
        Assert.True(File.Exists(masterTooltipPath));
        var snapshot = JsonConvert.DeserializeObject<MasterTooltipVocabularySnapshot>(File.ReadAllText(masterTooltipPath), JsonSettings.Default)!;
        Assert.Equal(2, snapshot.SchemaVersion);
        Assert.Equal("positive", snapshot.TooltipColors["p"].Text);
        Assert.Contains("master-tooltip", result.Artifacts.Keys);
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
            statTypes,
            EmptyItemCategories,
            EmptyItemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: PassingPreflight);
        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var statTypesPath = Path.Combine(publishedDir, "stat-types.json");
        Assert.True(File.Exists(statTypesPath));
        var envelope = JsonConvert.DeserializeObject<StatTypeSnapshotEnvelope>(File.ReadAllText(statTypesPath), JsonSettings.Default)!;
        Assert.Single(envelope.Rows);
        Assert.Equal("Strength", envelope.Rows[0].Fields.StatName);
        Assert.Contains("stat-types", result.Artifacts.Keys);
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
        var assetManifest = JsonConvert.DeserializeObject<AssetManifest>(File.ReadAllText(assetManifestPath), JsonSettings.Default)!;
        Assert.Contains(assetManifest.Assets, asset => asset.EntityId == "stat-type" && asset.RowId == "stat-strength" && asset.Slot == "iconRef");
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(statTypesPath)), manifest.Hashes["stat-types.json"]);
        Assert.Equal(1, manifest.Counts["stat-type"]);
    }

    [Fact]
    public async Task WritesItemCategoryArtifactAndHash()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-item-categories-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var categoryAssetPlan = new ItemIconAssetPlan();
        categoryAssetPlan.Manifest.Assets.Add(new AssetManifestEntry
        {
            EntityId = "item-category",
            RowId = "category-weapons",
            Slot = "defaultItemIconRef",
            Kind = "image",
            PngHash = "b",
            SourcePath = "assets/item-category/b.png",
        });
        var itemCategories = new FakeItemCategoryExtractionCache(new[]
        {
            new ItemCategorySnapshotRow
            {
                Id = "category-weapons",
                Fields = new ItemCategorySnapshot(
                    Id: "category-weapons",
                    CategoryName: "Weapons",
                    IconRef: null,
                    DefaultItemIconRef: null,
                    CategoryColor: new AssetColorSnapshot(),
                    ShowInAllCategory: true,
                    Columns: new List<ItemCategoryColumnSnapshot>()),
            },
        }, categoryAssetPlan);
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            itemCategories,
            EmptyItemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var itemCategoriesPath = Path.Combine(publishedDir, "item-categories.json");
        Assert.True(File.Exists(itemCategoriesPath));
        var envelope = JsonConvert.DeserializeObject<ItemCategorySnapshotEnvelope>(File.ReadAllText(itemCategoriesPath), JsonSettings.Default)!;
        Assert.Single(envelope.Rows);
        Assert.Equal("Weapons", envelope.Rows[0].Fields.CategoryName);
        Assert.Contains("item-categories", result.Artifacts.Keys);
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        var assetManifestPath = Path.Combine(publishedDir, "asset-manifest.json");
        var assetManifest = JsonConvert.DeserializeObject<AssetManifest>(File.ReadAllText(assetManifestPath), JsonSettings.Default)!;
        Assert.Contains(assetManifest.Assets, asset => asset.EntityId == "item-category" && asset.RowId == "category-weapons" && asset.Slot == "defaultItemIconRef");
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(itemCategoriesPath)), manifest.Hashes["item-categories.json"]);
        Assert.Equal(1, manifest.Counts["item-category"]);
    }

    [Fact]
    public async Task WritesItemTagArtifactAndHash()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-item-tags-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var itemTags = new FakeItemTagExtractionCache(new[]
        {
            new ItemTagSnapshotRow
            {
                Id = "tag-valuable-remedy",
                Fields = new PublicItemTagSnapshot(
                    Id: "tag-valuable-remedy",
                    TagName: "Valuable remedy",
                    Description: "Incredibly valuable remedy"),
            },
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            itemTags,
            EmptyLocations,
            EmptyPortals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var itemTagsPath = Path.Combine(publishedDir, "item-tags.json");
        Assert.True(File.Exists(itemTagsPath));
        var envelope = JsonConvert.DeserializeObject<ItemTagSnapshotEnvelope>(File.ReadAllText(itemTagsPath), JsonSettings.Default)!;
        Assert.Single(envelope.Rows);
        Assert.Equal("Valuable remedy", envelope.Rows[0].Fields.TagName);
        Assert.Contains("item-tags", result.Artifacts.Keys);
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(itemTagsPath)), manifest.Hashes["item-tags.json"]);
        Assert.Equal(1, manifest.Counts["item-tag"]);
    }

    [Fact]
    public async Task WritesLocationsArtifactAndManifestCount()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-locations-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var locations = new FakeLocationExtractionCache(new[]
        {
            new LocationSnapshotRow
            {
                Id = "11111111.fixture-town",
                Fields = new LocationSnapshot(
                    Id: "11111111.fixture-town",
                    GameLocationId: "town",
                    Name: "Harbor Town",
                    Enabled: true,
                    MapRef: null,
                    MapId: "ardenfall",
                    ShowOnMap: true,
                    ShowOnMapDebugOnly: false,
                    IconRef: null,
                    MapPosition: new LocationVector3Snapshot(12f, 3f, -8f),
                    AllowFastTravel: true,
                    FastTravelPosition: new LocationVector3Snapshot(14f, 4f, -10f),
                    DisplayOnEnterVolume: true,
                    Volumes: new List<LocationVolumeSnapshot>())
            }
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            locations,
            EmptyPortals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var locationsPath = Path.Combine(publishedDir, "locations.json");
        Assert.True(File.Exists(locationsPath));
        var envelope = JsonConvert.DeserializeObject<LocationSnapshotEnvelope>(File.ReadAllText(locationsPath), JsonSettings.Default)!;
        Assert.Single(envelope.Rows);
        Assert.Equal("Harbor Town", envelope.Rows[0].Fields.Name);
        Assert.Contains("locations", result.Artifacts.Keys);
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(locationsPath)), manifest.Hashes["locations.json"]);
        Assert.Equal(1, manifest.Counts["location"]);
    }

    [Fact]
    public async Task WritesPortalsArtifactAndManifestCount()
    {
        var runs = new CompendiumRunManager();
        var outputBaseDir = Directory.CreateTempSubdirectory("ardenfall-finalize-portals-test-").FullName;
        var run = runs.Begin(outputBaseDir, "test-version");
        WriteChunk(run, "000000.json", new ItemSnapshotRow
        {
            Id = "item-a",
            Fields = new Dictionary<string, object?>(),
        });
        var portals = new FakePortalExtractionCache(new[]
        {
            new PortalSnapshotRow
            {
                Id = "world;portals;portal-a",
                Fields = new PortalSnapshot(
                    Id: "world;portals;portal-a",
                    RecordRef: SnapshotRef.Record("world", "portals", "portal-a", "PortalRecord"),
                    Name: "Harbor Gate",
                    IsAccessible: true,
                    MapId: "ardenfall",
                    Position: new PortalVector3Snapshot(12f, 3f, -8f),
                    ConnectedPortalRef: SnapshotRef.Record("world", "portals", "portal-b", "PortalRecord"))
            }
        });
        var command = new RunFinalizeCommand(
            runs,
            new FakeItemExtractionCache(System.Array.Empty<Diagnostic>()),
            FakeMasterTooltipSource.Default,
            EmptyStatTypes,
            EmptyItemCategories,
            EmptyItemTags,
            EmptyLocations,
            portals,
            preflight: PassingPreflight);

        var result = await command.ExecuteAsync(TestControlCommandContext.Create<RunFinalizeResult>(), new RunIdArgs { RunId = run.RunId }, CancellationToken.None);

        Assert.Empty(result.Diagnostics);
        var manifestPath = result.Output!.ManifestPath;
        var publishedDir = Path.GetDirectoryName(manifestPath)!;
        var portalsPath = Path.Combine(publishedDir, "portals.json");
        Assert.True(File.Exists(portalsPath));
        var envelope = JsonConvert.DeserializeObject<PortalSnapshotEnvelope>(File.ReadAllText(portalsPath), JsonSettings.Default)!;
        Assert.Single(envelope.Rows);
        Assert.Equal("Harbor Gate", envelope.Rows[0].Fields.Name);
        Assert.Contains("portals", result.Artifacts.Keys);
        var manifest = JsonConvert.DeserializeObject<Manifest>(File.ReadAllText(manifestPath), JsonSettings.Default)!;
        Assert.Equal(ManifestBuilder.Sha256Hex(File.ReadAllText(portalsPath)), manifest.Hashes["portals.json"]);
        Assert.Equal(1, manifest.Counts["portal"]);
    }

    private static Diagnostic Diagnostic(string severity, string code) => new()
    {
        Severity = severity,
        Code = code,
        Field = "field",
        Message = code,
    };

    private static PreflightReport PassingPreflight() => new()
    {
        Passed = true,
        CompletedAt = "2026-05-20T00:00:00.0000000Z",
        Checks = { new PreflightCheck { Name = "fixture", Ok = true } },
    };

    private static PreflightReport FailingPreflight() => new()
    {
        Passed = false,
        CompletedAt = "2026-05-20T00:00:00.0000000Z",
        Checks = { new PreflightCheck { Name = "fixture", Ok = false, Reason = "not ready" } },
    };

    private static void SetItemPlan(CompendiumRun run, int total, int batchSize)
    {
        run.SetEntityPlan("item", total, batchSize);
    }

    private static void WriteChunk(CompendiumRun run, string fileName, ItemSnapshotRow row)
    {
        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        Directory.CreateDirectory(chunksDir);
        var json = JsonConvert.SerializeObject(new ItemSnapshotEnvelope { Rows = new List<ItemSnapshotRow> { row } }, JsonSettings.Default);
        File.WriteAllText(Path.Combine(chunksDir, fileName), json);
        var offset = int.Parse(Path.GetFileNameWithoutExtension(fileName));
        var hasExistingPlan = run.TryGetEntityPlan("item", out var existing);
        var existingChunks = hasExistingPlan
            ? new List<CompendiumEntityChunk>(existing.CompletedChunks)
            : new List<CompendiumEntityChunk>();
        var planTotal = System.Math.Max(hasExistingPlan ? existing.Total : 0, offset + 1);
        run.SetEntityPlan("item", planTotal, batchSize: 1);
        foreach (var chunk in existingChunks)
        {
            run.MarkEntityChunkComplete("item", chunk.Offset, chunk.Written);
        }
        run.MarkEntityChunkComplete("item", offset, written: 1);
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

        public int EvictionCount { get; private set; }

        public void Evict(CompendiumRun run) => EvictionCount++;

        public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run) => System.Array.Empty<ItemSnapshotRow>();

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

        public void Evict(CompendiumRun run) { }

        public IReadOnlyList<StatTypeSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => _assetPlan;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => System.Array.Empty<Diagnostic>();
    }

    private sealed class FakePortalExtractionCache : IPortalExtractionCache
    {
        private readonly IReadOnlyList<PortalSnapshotRow> _rows;
        private readonly IReadOnlyList<Diagnostic> _diagnostics;

        public FakePortalExtractionCache(IReadOnlyList<PortalSnapshotRow> rows, IReadOnlyList<Diagnostic>? diagnostics = null)
        {
            _rows = rows;
            _diagnostics = diagnostics ?? System.Array.Empty<Diagnostic>();
        }

        public void Evict(CompendiumRun run) { }

        public IReadOnlyList<PortalSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => _diagnostics;
    }

    private sealed class FakeItemCategoryExtractionCache : IItemCategoryExtractionCache
    {
        private readonly IReadOnlyList<ItemCategorySnapshotRow> _rows;
        private readonly ItemIconAssetPlan _assetPlan;

        public FakeItemCategoryExtractionCache(IReadOnlyList<ItemCategorySnapshotRow> rows, ItemIconAssetPlan? assetPlan = null)
        {
            _rows = rows;
            _assetPlan = assetPlan ?? new ItemIconAssetPlan();
        }

        public void Evict(CompendiumRun run) { }

        public IReadOnlyList<ItemCategorySnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => _assetPlan;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => System.Array.Empty<Diagnostic>();
    }

    private sealed class FakeItemTagExtractionCache : IItemTagExtractionCache
    {
        private readonly IReadOnlyList<ItemTagSnapshotRow> _rows;

        public FakeItemTagExtractionCache(IReadOnlyList<ItemTagSnapshotRow> rows)
        {
            _rows = rows;
        }

        public void Evict(CompendiumRun run) { }

        public IReadOnlyList<ItemTagSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => System.Array.Empty<Diagnostic>();
    }

    private sealed class FakeLocationExtractionCache : ILocationExtractionCache
    {
        private readonly IReadOnlyList<LocationSnapshotRow> _rows;
        private readonly IReadOnlyList<Diagnostic> _diagnostics;

        public FakeLocationExtractionCache(IReadOnlyList<LocationSnapshotRow> rows, IReadOnlyList<Diagnostic>? diagnostics = null)
        {
            _rows = rows;
            _diagnostics = diagnostics ?? System.Array.Empty<Diagnostic>();
        }

        public void Evict(CompendiumRun run) { }

        public IReadOnlyList<LocationSnapshotRow> GetOrExtract(CompendiumRun run) => _rows;

        public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => _diagnostics;
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

    private sealed class ThrowingMasterTooltipSource : IMasterTooltipSnapshotSource
    {
        public MasterTooltipVocabularySnapshot BuildSnapshot() => throw new System.InvalidOperationException("fixture failure");
    }
}
