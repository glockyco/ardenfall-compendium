using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class WorldWalkBatchArgs
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("offset", Required = Required.Always)]
    public int Offset { get; set; }

    [JsonProperty("limit", Required = Required.Always)]
    public int Limit { get; set; }
}
