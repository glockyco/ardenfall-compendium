using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class CompendiumPreflightResult
{
    [JsonProperty("ready", Required = Required.Always)]
    public bool Ready { get; set; }

    [JsonProperty("passed", Required = Required.Always)]
    public bool Passed { get; set; }

    [JsonProperty("completedAt", Required = Required.Always)]
    public string CompletedAt { get; set; } = string.Empty;

    [JsonProperty("productName", Required = Required.Always)]
    public string ProductName { get; set; } = string.Empty;

    [JsonProperty("gameVersion", Required = Required.Always)]
    public string GameVersion { get; set; } = string.Empty;

    [JsonProperty("checks", Required = Required.Always)]
    public List<PreflightCheck> Checks { get; set; } = new();
}
