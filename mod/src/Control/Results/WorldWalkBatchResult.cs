using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class WorldWalkCellReport
{
    [JsonProperty("cell")] public string Cell { get; set; } = string.Empty;

    [JsonProperty("objectsSeen")] public int ObjectsSeen { get; set; }

    [JsonProperty("harvested")] public int Harvested { get; set; }

    [JsonProperty("diagnostics")] public int Diagnostics { get; set; }
}

public sealed class WorldWalkBatchResult
{
    [JsonProperty("offset")] public int Offset { get; set; }

    [JsonProperty("limit")] public int Limit { get; set; }

    [JsonProperty("walked")] public int Walked { get; set; }

    [JsonProperty("pending")] public int Pending { get; set; }

    [JsonProperty("cells")] public List<WorldWalkCellReport> Cells { get; set; } = new();

    /// <summary>Component types seen in a cell that the walk does not publish yet.</summary>
    [JsonProperty("unmodelledTypes")] public Dictionary<string, int> UnmodelledTypes { get; set; } = new();
}
