using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class RunDiscardResult
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("discarded", Required = Required.Always)]
    public bool Discarded { get; set; }
}
