using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Npc;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class NpcExtractorTests
{
    [Fact]
    public void ExtractsNpcWithFriendlyNameAndContainingLocation()
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
                friendlyName: "Grainery Owner",
                mapId: "overworld",
                position: new NpcVector3Snapshot(12f, 3f, -8f),
                containingLocationRefs: new[] { location }),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("world;npcs;npc-a", row.Id);
        Assert.Equal("NPCRecord", row.Fields.RecordRef.RecordType);
        Assert.Equal("Grainery Owner", row.Fields.FriendlyName);
        Assert.Equal("overworld", row.Fields.MapId);
        Assert.Equal(12f, row.Fields.Position.X);
        Assert.Equal("location-guid", Assert.Single(row.Fields.ContainingLocationRefs).Guid);
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
                friendlyName: "Nested NPC",
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
                friendlyName: "Open NPC",
                mapId: "overworld",
                position: new NpcVector3Snapshot(0f, 0f, 0f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(row.Fields.ContainingLocationRefs);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void DiagnosesNpcWithBlankFriendlyNameAndLeavesNameNull()
    {
        var extractor = new NpcExtractor(new FakeNpcRecordSource(new[]
        {
            NpcRecordSourceRow.Build(
                table: "world",
                subtable: "npcs",
                id: "npc-no-name",
                friendlyName: " \t",
                mapId: "interior",
                position: new NpcVector3Snapshot(1f, 2f, 3f)),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.FriendlyName);
        Assert.Contains(row.Diagnostics, diagnostic =>
            diagnostic.Severity == "diagnostic" &&
            diagnostic.Code == "npcFriendlyNameMissing" &&
            diagnostic.Field == "friendlyName");
    }

    private sealed class FakeNpcRecordSource : INpcRecordSource
    {
        private readonly IReadOnlyList<NpcRecordSourceRow> _records;

        public FakeNpcRecordSource(IReadOnlyList<NpcRecordSourceRow> records)
        {
            _records = records;
        }

        public IEnumerable<NpcRecordSourceRow> EnumerateNpcs() => _records;
    }
}
