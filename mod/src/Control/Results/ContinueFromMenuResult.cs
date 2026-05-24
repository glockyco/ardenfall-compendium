using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class ContinueFromMenuResult
{
    [JsonProperty("clicked", Required = Required.Always)]
    public bool Clicked { get; set; }

    [JsonProperty("button", Required = Required.Always)]
    public string Button { get; set; } = string.Empty;
}
