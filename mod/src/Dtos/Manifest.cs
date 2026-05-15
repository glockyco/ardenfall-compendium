using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Dtos;


public sealed class SnapshotSource
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
}

public sealed class Manifest
{
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("gameVersion")] public string? GameVersion { get; init; }
    [JsonProperty("buildIdentifier")] public string? BuildIdentifier { get; init; }
    [JsonProperty("extractorVersion")] public string ExtractorVersion { get; init; } = "0.0.0";
    [JsonProperty("extractedAt")] public string ExtractedAt { get; init; } = "";
    [JsonProperty("source")] public SnapshotSource Source { get; init; } = new();
    [JsonProperty("preflight")] public PreflightReport Preflight { get; init; } = new();
    [JsonProperty("counts")] public Dictionary<string, int> Counts { get; init; } = new();
    [JsonProperty("diagnostics")] public DiagnosticTotals Diagnostics { get; init; } = new();
    [JsonProperty("hashes")] public Dictionary<string, string> Hashes { get; init; } = new();
}

public sealed class DiagnosticTotals
{
    [JsonProperty("fatal")] public int Fatal { get; set; }
    [JsonProperty("diagnostic")] public int Diagnostic { get; set; }
}
