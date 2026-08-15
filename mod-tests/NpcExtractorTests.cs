using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Npc;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class NpcExtractorTests
{
    [Fact]
    public void ExtractsPlacementNameSetOnItsCopy()
    {
        var location = SnapshotRef.LookupAsset(
            "location-guid",
            "Ardenfall.LocationAsset",
            "Harbor Town");
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-a",
                displayName: "Grainery Owner",
                displayNameProvenance: "own",
                displayNameOwner: null,
                authoringLabel: "grainery-owner",
                characterRef: SnapshotRef.NamedAsset("character", "preset_sapper"),
                mapId: "overworld",
                position: new NpcVector3Snapshot(12f, 3f, -8f),
                containingLocationRefs: new[] { location }),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("world;npcs;npc-a", row.Id);
        Assert.Equal("NPCRecord", row.Fields.RecordRef.RecordType);
        Assert.Equal("Grainery Owner", row.Fields.DisplayName);
        Assert.Equal("own", row.Fields.DisplayNameProvenance);
        Assert.Null(row.Fields.DisplayNameOwner);
        Assert.Equal("grainery-owner", row.Fields.AuthoringLabel);
        Assert.Equal("namedAsset", row.Fields.CharacterRef!.Kind);
        Assert.Equal("preset_sapper", row.Fields.CharacterRef.Name);
        Assert.Equal("overworld", row.Fields.MapId);
        Assert.Equal(12f, row.Fields.Position.X);
        Assert.Equal("location-guid", Assert.Single(row.Fields.ContainingLocationRefs).Guid);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void ReportsPrototypeNameWhenPlacementInheritsIt()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-inherited",
                displayName: "Prototype Sapper",
                displayNameProvenance: "inherited",
                displayNameOwner: "preset_sapper",
                authoringLabel: null,
                characterRef: SnapshotRef.NamedAsset("character", "preset_sapper"),
                mapId: "overworld",
                position: new NpcVector3Snapshot(0f, 0f, 0f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("Prototype Sapper", row.Fields.DisplayName);
        Assert.Equal("inherited", row.Fields.DisplayNameProvenance);
        Assert.Equal("preset_sapper", row.Fields.DisplayNameOwner);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void PreservesEveryContainingLocation()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-nested",
                displayName: "Nested NPC",
                displayNameProvenance: "own",
                displayNameOwner: null,
                authoringLabel: null,
                characterRef: null,
                mapId: "overworld",
                position: new NpcVector3Snapshot(0f, 0f, 0f),
                containingLocationRefs: new[]
                {
                    SnapshotRef.LookupAsset("outer-location"),
                    SnapshotRef.LookupAsset("inner-location"),
                }),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal(new[] { "outer-location", "inner-location" },
            row.Fields.ContainingLocationRefs.Select(reference => reference.Guid));
    }

    [Fact]
    public void EmitsNpcOutsideAllLocations()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-open",
                displayName: "Open NPC",
                displayNameProvenance: "own",
                displayNameOwner: null,
                authoringLabel: null,
                characterRef: null,
                mapId: "overworld",
                position: new NpcVector3Snapshot(0f, 0f, 0f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(row.Fields.ContainingLocationRefs);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void DiagnosesPlacementWithNoResolvedDisplayName()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-no-name",
                displayName: " \t",
                displayNameProvenance: "absent",
                displayNameOwner: null,
                authoringLabel: null,
                characterRef: null,
                mapId: "interior",
                position: new NpcVector3Snapshot(1f, 2f, 3f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.DisplayName);
        Assert.Equal("absent", row.Fields.DisplayNameProvenance);
        Assert.Contains(row.Diagnostics, diagnostic =>
            diagnostic.Severity == "diagnostic" &&
            diagnostic.Code == "npcDisplayNameMissing" &&
            diagnostic.Field == "displayName");
    }

    [Fact]
    public void FiltersRuntimeCreatedRecordsAndReportsCount()
    {
        var source = new FakeNpcRecordSource(
            records: new List<NpcRecordSourceRow>(),
            filteredRuntimeCreatedCount: 1);
        var extractor = new NpcExtractor(source);

        Assert.Empty(extractor.Walk());
        Assert.Equal(1, extractor.FilteredRuntimeCreatedCount);
        Assert.Equal(1, source.FilteredRuntimeCreatedCount);
    }

    [Fact]
    public void UsesParentNameForCloneNamedCopyCharacterReference()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-clone",
                displayName: "Clone Named NPC",
                displayNameProvenance: "own",
                displayNameOwner: null,
                authoringLabel: "clone-debug-label",
                characterRef: SnapshotRef.NamedAsset("character", "preset_sapper_stage1"),
                mapId: "overworld",
                position: new NpcVector3Snapshot(2f, 4f, 6f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("preset_sapper_stage1", row.Fields.CharacterRef!.Name);
        Assert.DoesNotContain("Clone", row.Fields.CharacterRef.Name!);
        Assert.Equal("clone-debug-label", row.Fields.AuthoringLabel);
    }

    [Fact]
    public void ExtractsPlacementMerchantStockAsOwn()
    {
        var stock = SnapshotRef.LookupAsset("item-stock");
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                "world", "npcs", "merchant-own", "Merchant", "own", null, null, null,
                "overworld", new NpcVector3Snapshot(0f, 0f, 0f),
                merchantRefs: new[] { stock }, merchantRefsProvenance: "own"),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("item-stock", Assert.Single(row.Fields.MerchantRefs).Guid);
        Assert.Equal("own", row.Fields.MerchantRefsProvenance);
        Assert.Null(row.Fields.MerchantRefsOwner);
    }

    [Fact]
    public void ExtractsPlacementFactionAsOwn()
    {
        var faction = SnapshotRef.LookupAsset("faction-own");
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                "world", "npcs", "faction-own", "Faction NPC", "own", null, null, null,
                "overworld", new NpcVector3Snapshot(0f, 0f, 0f),
                startingFactions: new[] { faction }, startingFactionsProvenance: "own"),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("faction-own", Assert.Single(row.Fields.StartingFactions).Guid);
        Assert.Equal("own", row.Fields.StartingFactionsProvenance);
        Assert.Null(row.Fields.StartingFactionsOwner);
    }

    [Fact]
    public void PreservesInheritedFactionsAndMerchantStock()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                "world", "npcs", "inherited-values", "Inherited NPC", "inherited", "preset_vendor", null, null,
                "overworld", new NpcVector3Snapshot(0f, 0f, 0f),
                startingFactions: new[] { SnapshotRef.LookupAsset("faction-inherited") },
                startingFactionsProvenance: "inherited", startingFactionsOwner: "preset_vendor",
                merchantRefs: new[] { SnapshotRef.LookupAsset("item-inherited") },
                merchantRefsProvenance: "inherited", merchantRefsOwner: "preset_vendor"),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("inherited", row.Fields.StartingFactionsProvenance);
        Assert.Equal("preset_vendor", row.Fields.StartingFactionsOwner);
        Assert.Equal("inherited", row.Fields.MerchantRefsProvenance);
        Assert.Equal("preset_vendor", row.Fields.MerchantRefsOwner);
    }

    [Fact]
    public void RepresentsAbsentMerchantStockWithoutDiagnostic()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                "world", "npcs", "no-stock", "No Stock NPC", "own", null, null, null,
                "overworld", new NpcVector3Snapshot(0f, 0f, 0f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(row.Fields.MerchantRefs);
        Assert.Equal("absent", row.Fields.MerchantRefsProvenance);
        Assert.Null(row.Fields.MerchantRefsOwner);
        Assert.DoesNotContain(row.Diagnostics, diagnostic => diagnostic.Field == "merchantRefs");
    }

    private sealed class FakeNpcRecordSource : INpcRecordSource
    {
        private readonly IReadOnlyList<NpcRecordSourceRow> _records;

        public FakeNpcRecordSource(
            IReadOnlyList<NpcRecordSourceRow> records,
            int filteredRuntimeCreatedCount = 0)
        {
            _records = records;
            FilteredRuntimeCreatedCount = filteredRuntimeCreatedCount;
        }

        public int FilteredRuntimeCreatedCount { get; }

        public IEnumerable<NpcRecordSourceRow> EnumerateNpcs() => _records;
    }
}
