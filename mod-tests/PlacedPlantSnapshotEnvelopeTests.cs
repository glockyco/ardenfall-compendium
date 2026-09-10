using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.World;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class PlacedPlantSnapshotEnvelopeTests
{
    [Fact]
    public void WritesRowsAsIdAndFields()
    {
        // The pipeline reads every entity envelope as { id, fields }. A flat row passed the
        // synthetic fixture, which was hand-written in the right shape, and failed the live export.
        var envelope = new PlacedPlantSnapshotEnvelope
        {
            Rows =
            {
                new PlacedPlantSnapshotRow
                {
                    Id = "scene;cell_a;guid-1",
                    Fields = new PlacedPlantFields
                    {
                        Id = "scene;cell_a;guid-1",
                        Cell = "cell_a",
                        HarvestXp = 10,
                    },
                },
            },
        };

        var json = JObject.Parse(JsonConvert.SerializeObject(envelope, JsonSettings.Default));

        Assert.Equal("placed-plant", json["entityId"]?.Value<string>());
        var row = json["rows"]?[0];
        Assert.Equal("scene;cell_a;guid-1", row?["id"]?.Value<string>());
        Assert.Equal("cell_a", row?["fields"]?["cell"]?.Value<string>());
        Assert.Equal(10, row?["fields"]?["harvestXp"]?.Value<int>());
    }
}
