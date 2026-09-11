using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Args;

/// <summary>What to capture: a map, a cell range of its declared grid, and a plate resolution.</summary>
public sealed class MapCaptureArgs
{
    [JsonProperty("runId", Required = Required.Always)]
    public string RunId { get; set; } = string.Empty;

    /// <summary>`overworld` or `interior`, which name both the map and its cell scenes.</summary>
    [JsonProperty("mapId", Required = Required.Always)]
    public string MapId { get; set; } = string.Empty;

    [JsonProperty("minCellX", Required = Required.Always)]
    public int MinCellX { get; set; }

    [JsonProperty("minCellY", Required = Required.Always)]
    public int MinCellY { get; set; }

    [JsonProperty("maxCellX", Required = Required.Always)]
    public int MaxCellX { get; set; }

    [JsonProperty("maxCellY", Required = Required.Always)]
    public int MaxCellY { get; set; }

    /// <summary>
    /// Plate size per cell. 512 over a 150-unit cell is 3.41 pixels per unit, which the resolution
    /// comparison settled as legible for the basemap; 1,024 is the detail level over authored cells.
    /// </summary>
    [JsonProperty("pixelsPerCell")]
    public int PixelsPerCell { get; set; } = 512;

    /// <summary>When true, omit declared cells that have no authored scene.</summary>
    [JsonProperty("authoredOnly")]
    public bool AuthoredOnly { get; set; }
}
