using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Item;

/// <summary>
/// Wire shape per snapshot.schema.json: { id, variant, fields, tags, presentation, provenance, diagnostics }.
/// Per-variant fields are flattened into `fields` so the pipeline canonicaliser can read them
/// uniformly regardless of variant depth. Presentation is a generated base-state UI contract
/// and is not a canonical field.
/// </summary>
public sealed class ItemSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("variant")] public string Variant { get; init; } = "";
    [JsonProperty("fields")] public Dictionary<string, object?> Fields { get; init; } = new();
    [JsonProperty("tags")] public List<string> Tags { get; init; } = new();
    [JsonProperty("presentation")] public ItemPresentationSnapshot Presentation { get; init; } = new();
    [JsonProperty("provenance")] public Dictionary<string, Provenance> Provenance { get; init; } = new();
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class ItemSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "item";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 2;
    [JsonProperty("rows")] public List<ItemSnapshotRow> Rows { get; init; } = new();
}
