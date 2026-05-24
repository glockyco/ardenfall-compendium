using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class RunIdArgs
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;
}
