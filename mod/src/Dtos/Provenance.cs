using Newtonsoft.Json;

namespace ArdenfallCompendium.Dtos;

public sealed class Provenance
{
    [JsonProperty("kind")] public string Kind { get; init; } = "missing"; // see schema enum
    [JsonProperty("source")] public string Source { get; init; } = "";
    [JsonProperty("isSet")] public bool IsSet { get; init; }
    [JsonProperty("inherited")] public bool Inherited { get; init; }
    [JsonProperty("parent")] public ParentRef? Parent { get; init; }
}

public sealed class ParentRef
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
    [JsonProperty("guid")] public string? Guid { get; init; }
    [JsonProperty("unityType")] public string? UnityType { get; init; }
}
