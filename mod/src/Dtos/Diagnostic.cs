using Newtonsoft.Json;

namespace ArdenfallCompendium.Dtos;

public sealed class Diagnostic
{
    [JsonProperty("severity")] public string Severity { get; init; } = "diagnostic"; // "fatal" | "diagnostic"
    [JsonProperty("code")] public string Code { get; init; } = "";
    [JsonProperty("field")] public string Field { get; init; } = "";
    [JsonProperty("message")] public string? Message { get; init; }
}
