using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class OperatorEnabledArgs
{
    /// <summary>
    /// Required. An absent value would silently disable the thing an operator asked about, so the
    /// command rejects it instead of defaulting.
    /// </summary>
    [JsonProperty("enabled")]
    public bool? Enabled { get; set; }
}
