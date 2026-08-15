using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Location;
using UnityEngine;
using Xunit;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Tests;

public sealed class LocationExtractorTests
{
    [Fact]
    public void ExtractsEnabledLocationWithMapPointAndVolume()
    {
        var source = new FakeLocationAssetSource(new[]
        {
            FakeLocationAssetSource.Build(
                guid: "11111111.fixture-town",
                assetName: "Town Asset",
                locationName: "Harbor Town",
                mapId: "ardenfall",
                mapPosition: new LocationVector3Snapshot(12f, 3f, -8f),
                fastTravelPosition: new LocationVector3Snapshot(14f, 4f, -10f),
                volumes: new[]
                {
                    new LocationVolumeSnapshot(0, new LocationVector3Snapshot(10f, 2f, -20f), new LocationVector3Snapshot(6f, 4f, 8f)),
                })
        });
        var extractor = new LocationExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("11111111.fixture-town", row.Id);
        Assert.Equal("Harbor Town", row.Fields.Name);
        Assert.True(row.Fields.Enabled);
        Assert.Equal("ardenfall", row.Fields.MapId);
        Assert.True(row.Fields.ShowOnMap);
        Assert.False(row.Fields.ShowOnMapDebugOnly);
        Assert.True(row.Fields.AllowFastTravel);
        Assert.Equal(12f, row.Fields.MapPosition.X);
        var volume = Assert.Single(row.Fields.Volumes);
        Assert.Equal(0, volume.Index);
        Assert.Equal(10f, volume.Center.X);
        Assert.Equal(8f, volume.Size.Z);
    }

    [Fact]
    public void DiagnosesNullVolumesInsteadOfThrowing()
    {
        var source = new FakeLocationAssetSource(new[]
        {
            FakeLocationAssetSource.Build(
                guid: "location-malformed",
                assetName: "Malformed",
                locationName: "Malformed",
                mapId: "ardenfall",
                mapPosition: new LocationVector3Snapshot(0f, 0f, 0f),
                fastTravelPosition: null,
                volumes: null),
        });
        var extractor = new LocationExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Single(rows);
        Assert.Empty(rows[0].Fields.Volumes);
        var diagnostic = Assert.Single(rows[0].Diagnostics);
        Assert.Equal("locationVolumesMalformed", diagnostic.Code);
        Assert.Equal("volumes", diagnostic.Field);
        var message = diagnostic.Message;
        Assert.NotNull(message);
        if (message is null)
        {
            throw new Xunit.Sdk.XunitException("Expected a location volume diagnostic message.");
        }
        Assert.Contains("location-malformed", message);
    }

    [Fact]
    public void DiagnosesLocationMissingGuid()
    {
        var source = new FakeLocationAssetSource(new[]
        {
            FakeLocationAssetSource.BuildWithoutGuid("No Guid Location"),
        });
        var extractor = new LocationExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    [Fact]
    public void BuiltLookupSourceExtractsDisabledLocations()
    {
        var enabled = RuntimeLocation("enabled", enabled: true);
        var disabled = RuntimeLocation("disabled", enabled: false);
        var source = new BuiltLookupTableLocationAssetSource(
            lookupLocations: () => new[] { enabled, disabled },
            isUnityNull: _ => false,
            lookupGuid: asset => ReferenceEquals(asset, enabled) ? "enabled-guid" : "disabled-guid",
            assetName: asset => ((LocationAsset)asset).locationID);

        var rows = new LocationExtractor(source).Walk().ToList();

        Assert.Equal(2, rows.Count);
        Assert.True(Assert.Single(rows, row => row.Id == "enabled-guid").Fields.Enabled);
        var disabledRow = Assert.Single(rows, row => row.Id == "disabled-guid");
        Assert.False(disabledRow.Fields.Enabled);
    }

    private sealed class FakeLocationAssetSource : ILocationAssetSource
    {
        private readonly IReadOnlyList<LocationAssetRecord> _assets;

        public FakeLocationAssetSource(IReadOnlyList<LocationAssetRecord> assets)
        {
            _assets = assets;
        }

        public IEnumerable<LocationAssetRecord> EnumerateLocations() => _assets;

        public static LocationAssetRecord Build(
            string guid,
            string assetName,
            string locationName,
            string mapId,
            LocationVector3Snapshot mapPosition,
            LocationVector3Snapshot? fastTravelPosition,
            IReadOnlyList<LocationVolumeSnapshot?>? volumes) => new(
                Guid: guid,
                AssetName: assetName,
                Enabled: true,
                LocationName: locationName,
                MapRef: SnapshotRef.LookupAsset("map-guid", "MapData", mapId),
                MapId: mapId,
                ShowOnMap: true,
                ShowOnMapDebugOnly: false,
                IconRef: SnapshotRef.Missing("not-exported-in-slice-5", "LocationAsset.icon"),
                MapPosition: mapPosition,
                AllowFastTravel: fastTravelPosition != null,
                FastTravelPosition: fastTravelPosition,
                Volumes: volumes);

        public static LocationAssetRecord BuildWithoutGuid(string name) => new(
            Guid: null,
            AssetName: name,
            Enabled: true,
            LocationName: name,
            MapRef: null,
            MapId: null,
            ShowOnMap: true,
            ShowOnMapDebugOnly: false,
            IconRef: null,
            MapPosition: new LocationVector3Snapshot(0f, 0f, 0f),
            AllowFastTravel: false,
            FastTravelPosition: null,
            Volumes: new List<LocationVolumeSnapshot>());
    }

    private static LocationAsset RuntimeLocation(string id, bool enabled)
    {
        var location = (LocationAsset)RuntimeHelpers.GetUninitializedObject(typeof(LocationAsset));
        location.locationID = id;
        location.locationName = id;
        location.enabled = enabled;
        location.mapPosition = Vector3.zero;
        location.fastTravelPosition = Vector3.zero;
        location.volumes = new List<LocationAsset.Volume>();
        return location;
    }
}
