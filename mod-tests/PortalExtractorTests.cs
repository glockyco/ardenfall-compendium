using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Portal;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class PortalExtractorTests
{
    [Fact]
    public void ExtractsPortalRecordWithRawTransformAndConnectedPortalRef()
    {
        var source = new FakePortalRecordSource(new[]
        {
            PortalRecordSourceRow.Build(
                table: "world",
                subtable: "portals",
                id: "portal-a",
                friendlyName: "Harbor Gate",
                mapId: "ardenfall",
                position: new PortalVector3Snapshot(12f, 3f, -8f),
                connectedPortalRef: SnapshotRef.Record("world", "portals", "portal-b", "PortalRecord"),
                connectedPortalResolved: true),
        });
        var extractor = new PortalExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("world;portals;portal-a", row.Id);
        Assert.Equal("world;portals;portal-a", row.Fields.Id);
        Assert.Equal("Harbor Gate", row.Fields.Name);
        Assert.Equal("ardenfall", row.Fields.MapId);
        Assert.Equal(12f, row.Fields.Position.X);
        Assert.Equal(3f, row.Fields.Position.Y);
        Assert.Equal(-8f, row.Fields.Position.Z);
        Assert.Equal("record", row.Fields.RecordRef.Kind);
        Assert.Equal("world", row.Fields.RecordRef.Table);
        Assert.Equal("portals", row.Fields.RecordRef.Subtable);
        Assert.Equal("portal-a", row.Fields.RecordRef.Id);
        Assert.Equal("portal-b", row.Fields.ConnectedPortalRef!.Id);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void DiagnosesPortalMissingRecordId()
    {
        var source = new FakePortalRecordSource(new[]
        {
            PortalRecordSourceRow.Build(
                table: "world",
                subtable: "portals",
                id: "",
                friendlyName: "Broken Portal",
                mapId: "ardenfall",
                position: new PortalVector3Snapshot(0f, 0f, 0f)),
        });
        var extractor = new PortalExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Severity == "fatal" && d.Code == "portalRecordIdMissing" && d.Field == "id");
    }

    [Fact]
    public void DiagnosesPortalMissingMapAndConnectedPortal()
    {
        var source = new FakePortalRecordSource(new[]
        {
            PortalRecordSourceRow.Build(
                table: "world",
                subtable: "portals",
                id: "portal-a",
                friendlyName: "Broken Portal",
                mapId: null,
                position: new PortalVector3Snapshot(0f, 0f, 0f),
                connectedPortalRef: SnapshotRef.Record("world", "portals", "missing", "PortalRecord"),
                connectedPortalResolved: false),
        });
        var extractor = new PortalExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Contains(row.Diagnostics, d => d.Severity == "diagnostic" && d.Code == "portalMapMissing" && d.Field == "mapId");
        Assert.Contains(row.Diagnostics, d => d.Severity == "diagnostic" && d.Code == "connectedPortalMissing" && d.Field == "connectedPortalRef");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void DiagnosesMissingFriendlyNameInsteadOfSubstitutingTheRowId(string? friendlyName)
    {
        var source = new FakePortalRecordSource(new[]
        {
            PortalRecordSourceRow.Build(
                table: "world",
                subtable: "portals",
                id: "portal-a",
                friendlyName: friendlyName,
                mapId: "overworld",
                position: new PortalVector3Snapshot(0f, 0f, 0f),
                connectedPortalRef: null,
                connectedPortalResolved: false),
        });
        var extractor = new PortalExtractor(source);

        var row = Assert.Single(extractor.Walk());

        // The row id must not stand in for a name: an id-shaped label is
        // indistinguishable from an authored one downstream, which is how an
        // unnamed portal previously shipped a public route labelled with its id.
        Assert.Null(row.Fields.Name);
        Assert.DoesNotContain(row.Diagnostics, d => d.Code == "portalNameMissing" && d.Severity != "diagnostic");
        Assert.Contains(row.Diagnostics, d => d.Code == "portalNameMissing" && d.Field == "friendlyName");
    }

    [Fact]
    public void KeepsAnAuthoredFriendlyNameAndStaysSilent()
    {
        var source = new FakePortalRecordSource(new[]
        {
            PortalRecordSourceRow.Build(
                table: "world",
                subtable: "portals",
                id: "portal-a",
                friendlyName: "Harbor Gate",
                mapId: "overworld",
                position: new PortalVector3Snapshot(0f, 0f, 0f),
                connectedPortalRef: null,
                connectedPortalResolved: false),
        });
        var extractor = new PortalExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("Harbor Gate", row.Fields.Name);
        Assert.DoesNotContain(row.Diagnostics, d => d.Code == "portalNameMissing");
    }

    private sealed class FakePortalRecordSource : IPortalRecordSource
    {
        private readonly IReadOnlyList<PortalRecordSourceRow> _records;

        public FakePortalRecordSource(IReadOnlyList<PortalRecordSourceRow> records)
        {
            _records = records;
        }

        public IEnumerable<PortalRecordSourceRow> EnumeratePortals() => _records;
    }
}
