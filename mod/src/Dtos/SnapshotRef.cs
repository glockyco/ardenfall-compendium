using Newtonsoft.Json;

namespace ArdenfallArchives.Dtos;

public sealed class SnapshotRef
{
    [JsonProperty("kind")] public string Kind { get; init; } = "missing";
    [JsonProperty("guid")] public string? Guid { get; init; }
    [JsonProperty("unityType")] public string? UnityType { get; init; }
    [JsonProperty("name")] public string? Name { get; init; }
    [JsonProperty("table")] public string? Table { get; init; }
    [JsonProperty("subtable")] public string? Subtable { get; init; }
    [JsonProperty("id")] public string? Id { get; init; }
    [JsonProperty("recordType")] public string? RecordType { get; init; }
    [JsonProperty("extractionId")] public string? ExtractionId { get; init; }
    [JsonProperty("stable")] public bool? Stable { get; init; }
    [JsonProperty("reason")] public string? Reason { get; init; }
    [JsonProperty("source")] public string? Source { get; init; }

    public static SnapshotRef LookupAsset(string guid, string? unityType = null, string? name = null) =>
        new() { Kind = "lookupAsset", Guid = guid, UnityType = unityType, Name = name };

    public static SnapshotRef Missing(string reason, string source) =>
        new() { Kind = "missing", Reason = reason, Source = source };

    public static SnapshotRef Record(string table, string subtable, string id, string? recordType = null) =>
        new() { Kind = "record", Table = table, Subtable = subtable, Id = id, RecordType = recordType };
}
