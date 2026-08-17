using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class OperatorTimescaleResult
{
    [JsonProperty("timescale", Required = Required.Always)]
    public float Timescale { get; set; }
}
