using Newtonsoft.Json;
using System.Collections.Generic;

namespace ArdenfallCompendium.Control.Results;

public sealed class RunFinalizeResult
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("publishedDir", Required = Required.AllowNull)]
    public string PublishedDir { get; set; } = string.Empty;

    [JsonProperty("manifestPath", Required = Required.Always)]
    public string ManifestPath { get; set; } = string.Empty;

    [JsonProperty("timings", Required = Required.Always)]
    public List<RunFinalizeTiming> Timings { get; set; } = new();
}

public sealed class RunFinalizeTiming
{
    [JsonProperty("phase", Required = Required.Always)]
    public string Phase { get; set; } = string.Empty;

    [JsonProperty("elapsedMs", Required = Required.Always)]
    public long ElapsedMs { get; set; }

    [JsonProperty("totalElapsedMs", Required = Required.Always)]
    public long TotalElapsedMs { get; set; }
}
