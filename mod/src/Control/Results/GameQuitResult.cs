using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class GameQuitResult
{
    [JsonProperty("quitting", Required = Required.Always)]
    public bool Quitting { get; set; }
}
