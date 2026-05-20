using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.ItemTag;

public sealed record ItemTagSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("tagName")] string TagName,
    [property: JsonProperty("description")] string Description);

public sealed class ItemTagSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public ItemTagSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class ItemTagSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "item-tag";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<ItemTagSnapshotRow> Rows { get; init; } = new();
}
