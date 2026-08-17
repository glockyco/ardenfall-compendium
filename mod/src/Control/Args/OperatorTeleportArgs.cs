using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class OperatorTeleportArgs
{
    /// <summary>Required. The horizontal target; the command finds its own height.</summary>
    [JsonProperty("x")]
    public float? X { get; set; }

    /// <summary>Required. The horizontal target; the command finds its own height.</summary>
    [JsonProperty("z")]
    public float? Z { get; set; }
}
