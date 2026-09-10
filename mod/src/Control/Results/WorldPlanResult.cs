using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class WorldPlanCell
{
    [JsonProperty("buildIndex")] public int BuildIndex { get; set; }

    [JsonProperty("name")] public string Name { get; set; } = string.Empty;
}

public sealed class WorldPlanResult
{
    [JsonProperty("total")] public int Total { get; set; }

    [JsonProperty("batchSize")] public int BatchSize { get; set; }

    [JsonProperty("scenesInBuild")] public int ScenesInBuild { get; set; }

    /// <summary>Cell scenes the engine cannot stream, which the walk skips rather than fails on.</summary>
    [JsonProperty("unloadable")] public int Unloadable { get; set; }

    [JsonProperty("cells")] public List<WorldPlanCell> Cells { get; set; } = new();
}
