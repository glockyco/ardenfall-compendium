using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace ArdenfallCompendium.Dtos;

public sealed class AssetManifest
{
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("assets")] public List<AssetManifestEntry> Assets { get; init; } = new();
    [JsonProperty("itemIconMetadata")] public List<ItemIconMetadataEntry> ItemIconMetadata { get; init; } = new();
}

public sealed class AssetManifestEntry
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "";
    [JsonProperty("rowId")] public string RowId { get; init; } = "";
    [JsonProperty("slot")] public string Slot { get; init; } = "";
    [JsonProperty("kind")] public string Kind { get; init; } = "image";
    [JsonProperty("pngHash")] public string PngHash { get; init; } = "";
    [JsonProperty("sourcePath")] public string SourcePath { get; init; } = "";
}

public sealed class ItemIconMetadataEntry
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "item";
    [JsonProperty("rowId")] public string RowId { get; init; } = "";
    [JsonProperty("displayIconColor")] public AssetColorSnapshot DisplayIconColor { get; init; } = new();
    [JsonProperty("secondaryIconColor")] public AssetColorSnapshot? SecondaryIconColor { get; init; }
}

public sealed class AssetColorSnapshot
{
    [JsonProperty("r")] public float R { get; init; } = 1f;
    [JsonProperty("g")] public float G { get; init; } = 1f;
    [JsonProperty("b")] public float B { get; init; } = 1f;
    [JsonProperty("a")] public float A { get; init; } = 1f;

    public static AssetColorSnapshot FromColor(Color color) => new() { R = color.r, G = color.g, B = color.b, A = color.a };
}
