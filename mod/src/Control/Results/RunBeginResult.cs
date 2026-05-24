using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class RunBeginResult
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("workspaceDir", Required = Required.Always)]
    public string WorkspaceDir { get; set; } = string.Empty;
}
