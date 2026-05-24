using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class EntityExportBatchResult
{
    [JsonProperty("entity", Required = Required.Always)]
    public string Entity { get; set; } = string.Empty;

    [JsonProperty("offset", Required = Required.Always)]
    public int Offset { get; set; }

    [JsonProperty("limit", Required = Required.Always)]
    public int Limit { get; set; }

    [JsonProperty("written", Required = Required.Always)]
    public int Written { get; set; }

    [JsonProperty("total", Required = Required.Always)]
    public int Total { get; set; }
}
