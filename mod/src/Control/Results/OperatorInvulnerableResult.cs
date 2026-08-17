using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class OperatorInvulnerableResult
{
    /// <summary>The live flag after the command ran. It is the game's damage floor, not immunity.</summary>
    [JsonProperty("invulnerable", Required = Required.Always)]
    public bool Invulnerable { get; set; }
}
