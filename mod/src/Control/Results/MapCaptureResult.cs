using Newtonsoft.Json;

namespace ArdenfallCompendium.Control.Results;

public sealed class MapCaptureResult
{
    [JsonProperty("mapId")] public string MapId { get; set; } = string.Empty;

    [JsonProperty("tiles")] public int Tiles { get; set; }

    [JsonProperty("requestedCells")] public int RequestedCells { get; set; }

    [JsonProperty("capturedCells")] public int CapturedCells { get; set; }

    /// <summary>Tiles whose cell ships an authored scene, as against a distant prefab.</summary>
    [JsonProperty("authoredTiles")] public int AuthoredTiles { get; set; }

    [JsonProperty("bytes")] public long Bytes { get; set; }

    [JsonProperty("pixelsPerUnit")] public float PixelsPerUnit { get; set; }

    /// <summary>False when the capture could not undo a change it made, which fails the phase.</summary>
    [JsonProperty("restored")] public bool Restored { get; set; }

    /// <summary>Where the capture wrote its plates and its record, under the run's staging tree.</summary>
    [JsonProperty("stagingDir")] public string StagingDir { get; set; } = string.Empty;
}
