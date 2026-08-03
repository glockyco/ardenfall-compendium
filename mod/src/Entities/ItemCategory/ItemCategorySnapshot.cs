using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed record ItemCategorySnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("categoryName")] string? CategoryName,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("defaultItemIconRef")] SnapshotRef? DefaultItemIconRef,
    [property: JsonProperty("categoryColor")] AssetColorSnapshot CategoryColor,
    [property: JsonProperty("showInAllCategory")] bool ShowInAllCategory,
    [property: JsonProperty("columns")] List<ItemCategoryColumnSnapshot> Columns);

public sealed class ItemCategorySnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public ItemCategorySnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class ItemCategorySnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "item-category";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<ItemCategorySnapshotRow> Rows { get; init; } = new();
}
