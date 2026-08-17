using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class OperatorDeathRecoveryResult
{
    [JsonProperty("alive", Required = Required.Always)]
    public bool Alive { get; set; }

    /// <summary>Whether the character was dead and this command brought it back.</summary>
    [JsonProperty("revived", Required = Required.Always)]
    public bool Revived { get; set; }

    /// <summary>Whether the death interface was open and this command closed it.</summary>
    [JsonProperty("deathInterfaceClosed", Required = Required.Always)]
    public bool DeathInterfaceClosed { get; set; }

    /// <summary>
    /// Whether this command stopped the animation override. The game plays the death clip with
    /// <c>stopOnFinish: false</c>, so recovery always stops it.
    /// </summary>
    [JsonProperty("animationOverrideStopped", Required = Required.Always)]
    public bool AnimationOverrideStopped { get; set; }
}
