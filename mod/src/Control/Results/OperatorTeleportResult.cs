using ArdenfallCompendium.Control.OperatorTools;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class OperatorTeleportResult
{
    [JsonProperty("position", Required = Required.Always)]
    public OperatorPoint Position { get; set; }

    /// <summary>The height of the surface the command placed the character above.</summary>
    [JsonProperty("surfaceHeight", Required = Required.Always)]
    public float SurfaceHeight { get; set; }

    /// <summary>The name of that surface, so an operator can tell a rooftop from a seabed.</summary>
    [JsonProperty("surface", Required = Required.Always)]
    public string Surface { get; set; } = string.Empty;
}
