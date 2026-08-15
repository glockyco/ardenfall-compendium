using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.NameSet;

public sealed record NameSetSeedSnapshot(
    [property: JsonProperty("name")] string Name,
    [property: JsonProperty("weight")] int Weight);

public sealed record NameSetSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("seeds")] List<NameSetSeedSnapshot> Seeds,
    [property: JsonProperty("generationOrder")] int GenerationOrder);

public sealed class NameSetSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public NameSetSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class NameSetSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "name-set";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<NameSetSnapshotRow> Rows { get; init; } = new();
}
