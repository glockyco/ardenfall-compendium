using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class RunFinalizeResult
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("publishedDir", Required = Required.AllowNull)]
    public string PublishedDir { get; set; } = string.Empty;

    [JsonProperty("manifestPath", Required = Required.Always)]
    public string ManifestPath { get; set; } = string.Empty;
}
