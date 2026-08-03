using System.Collections.Generic;
using ArdenfallCompendium.Entities.Location;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class LocationSnapshotTests
{
    [Fact]
    public void SerializesLocationEnvelopeWithEntityIdAndRows()
    {
        var envelope = new LocationSnapshotEnvelope
        {
            Rows = new List<LocationSnapshotRow>
            {
                new()
                {
                    Id = "11111111.fixture-town",
                    Fields = new LocationSnapshot(
                        Id: "11111111.fixture-town",
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
                        Volumes: new List<LocationVolumeSnapshot>
                        {
                            new(0, new LocationVector3Snapshot(10f, 2f, -20f), new LocationVector3Snapshot(6f, 4f, 8f)),
                        })
                }
            }
        };

        var json = JsonConvert.SerializeObject(envelope);
        var parsed = JObject.Parse(json);

        Assert.Equal("location", parsed["entityId"]?.Value<string>());
        Assert.Equal(1, parsed["schemaVersion"]?.Value<int>());
        Assert.Equal("Harbor Town", parsed["rows"]?[0]?["fields"]?["name"]?.Value<string>());
        Assert.Equal(10f, parsed["rows"]?[0]?["fields"]?["volumes"]?[0]?["center"]?["x"]?.Value<float>());
    }
}
