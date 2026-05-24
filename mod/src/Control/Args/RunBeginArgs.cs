using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class RunBeginArgs
{
    [JsonProperty("outputBaseDir")]
    public string? OutputBaseDir { get; set; }

    [JsonProperty("gameVersion")]
    public string? GameVersion { get; set; }
}
