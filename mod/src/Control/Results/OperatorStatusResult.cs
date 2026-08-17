using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class OperatorStatusResult
{
    [JsonProperty("invulnerable", Required = Required.Always)]
    public bool Invulnerable { get; set; }

    [JsonProperty("photoMode", Required = Required.Always)]
    public bool PhotoMode { get; set; }

    [JsonProperty("timescale", Required = Required.Always)]
    public float Timescale { get; set; }

    [JsonProperty("roamingClampLifted", Required = Required.Always)]
    public bool RoamingClampLifted { get; set; }

    /// <summary>The live flag, not the recorded one, so a drifted value is visible.</summary>
    [JsonProperty("debugTools", Required = Required.Always)]
    public bool DebugTools { get; set; }

    /// <summary>Every value this session changed and has not restored.</summary>
    [JsonProperty("changed", Required = Required.Always)]
    public IReadOnlyList<string> Changed { get; set; } = new List<string>();
}
