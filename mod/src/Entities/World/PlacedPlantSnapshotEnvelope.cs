using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

public sealed class PlacedPlantSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";

    [JsonProperty("fields")] public PlacedPlantFields Fields { get; init; } = null!;

    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class PlacedPlantSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "placed-plant";

    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;

    [JsonProperty("rows")] public List<PlacedPlantSnapshotRow> Rows { get; init; } = new();
}
