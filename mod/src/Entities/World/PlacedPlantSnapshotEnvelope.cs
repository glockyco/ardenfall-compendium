using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

public sealed class PlacedPlantSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; set; } = "placed-plant";

    [JsonProperty("schemaVersion")] public int SchemaVersion { get; set; } = 1;

    [JsonProperty("rows")] public List<PlacedPlantFields> Rows { get; set; } = new();
}
