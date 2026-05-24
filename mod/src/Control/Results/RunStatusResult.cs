using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class RunStatusResult
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("state", Required = Required.Always)]
    public string State { get; set; } = string.Empty;

    [JsonProperty("counts", Required = Required.Always)]
    public IReadOnlyDictionary<string, int> Counts { get; set; } = new Dictionary<string, int>();

    [JsonProperty("finalized", Required = Required.Always)]
    public bool Finalized { get; set; }

    [JsonProperty("workspaceDir", Required = Required.Always)]
    public string WorkspaceDir { get; set; } = string.Empty;

    [JsonProperty("publishedDir", Required = Required.AllowNull)]
    public string? PublishedDir { get; set; }
}
