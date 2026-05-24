using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

public sealed class EntityPlanArgs
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    [JsonProperty("entity", Required = Required.Always)]
    public string Entity { get; set; } = string.Empty;
}
