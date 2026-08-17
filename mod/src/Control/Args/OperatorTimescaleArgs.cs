using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class OperatorTimescaleArgs
{
    /// <summary>Required. The tool timescale to apply, from 0 through 1 inclusive.</summary>
    [JsonProperty("scale")]
    public float? Scale { get; set; }
}
