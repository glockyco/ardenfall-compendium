using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallArchives.Dtos;

public sealed class PreflightReport
{
    [JsonProperty("passed")] public bool Passed { get; set; }
    [JsonProperty("completedAt")] public string CompletedAt { get; set; } = "";
    [JsonProperty("checks")] public List<PreflightCheck> Checks { get; init; } = new();
}

public sealed class PreflightCheck
{
    [JsonProperty("name")] public string Name { get; init; } = "";
    [JsonProperty("ok")] public bool Ok { get; init; }
    [JsonProperty("reason")] public string? Reason { get; init; }
}
