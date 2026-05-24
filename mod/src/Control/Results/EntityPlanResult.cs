using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class EntityPlanResult
{
    [JsonProperty("entity", Required = Required.Always)]
    public string Entity { get; set; } = string.Empty;

    [JsonProperty("total", Required = Required.Always)]
    public int Total { get; set; }

    [JsonProperty("batchSize", Required = Required.Always)]
    public int BatchSize { get; set; }

    [JsonProperty("batches", Required = Required.Always)]
    public int Batches { get; set; }
}
