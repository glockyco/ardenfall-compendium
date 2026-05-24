using System;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class CompendiumInfoResult
{
    [JsonProperty("apiVersion", Required = Required.Always)]
    public int ApiVersion { get; set; }

    [JsonProperty("extractorVersion", Required = Required.Always)]
    public string ExtractorVersion { get; set; } = string.Empty;

    [JsonProperty("gameVersion", Required = Required.Always)]
    public string GameVersion { get; set; } = string.Empty;

    [JsonProperty("supportedEntities", Required = Required.Always)]
    public string[] SupportedEntities { get; set; } = Array.Empty<string>();
}
