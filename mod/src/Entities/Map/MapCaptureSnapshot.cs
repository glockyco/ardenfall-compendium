using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Map;

/// <summary>The grid declaration that owns a map capture's bounds.</summary>
public sealed class MapCaptureGrid
{
    public MapCaptureGrid(int offsetX, int offsetY, int sizeX, int sizeY, int cellSize)
    {
        OffsetX = offsetX;
        OffsetY = offsetY;
        SizeX = sizeX;
        SizeY = sizeY;
        CellSize = cellSize;
    }

    public int OffsetX { get; }
    public int OffsetY { get; }
    public int SizeX { get; }
    public int SizeY { get; }
    public int CellSize { get; }
}

/// <summary>One captured cell, and where its plate landed in the staging tree.</summary>
public sealed class MapCaptureTileSnapshot
{
    [JsonProperty("cellX")] public int CellX { get; set; }

    [JsonProperty("cellY")] public int CellY { get; set; }

    /// <summary>The content hash of the plate, which is also its file name.</summary>
    [JsonProperty("hash")] public string Hash { get; set; } = "";

    [JsonProperty("path")] public string Path { get; set; } = "";

    [JsonProperty("bytes")] public int Bytes { get; set; }

    /// <summary>True when the declared cell contains no renderable geometry.</summary>
    [JsonProperty("empty")] public bool Empty { get; set; }

    /// <summary>
    /// True when the cell ships an authored scene rather than a distant prefab.
    /// </summary>
    /// <remarks>
    /// 24 of 575 overworld cells ship a scene. The rest capture from a distant prefab, whose detail
    /// ranges from two renderers, a flat colour plate, to 1,541. A reader who sees terrain expects
    /// it to be real, so the difference is recorded per cell rather than blended away.
    /// </remarks>
    [JsonProperty("authored")] public bool Authored { get; set; }

    /// <summary>Renderers the frame held, so an empty plate is distinguishable from a failed one.</summary>
    [JsonProperty("renderers")] public int Renderers { get; set; }
}

/// <summary>What a capture pinned, so a later run can be compared against it.</summary>
public sealed class MapCaptureInputs
{
    [JsonProperty("mapId")] public string MapId { get; set; } = "";

    [JsonProperty("gameVersion")] public string GameVersion { get; set; } = "";

    [JsonProperty("gridOffsetX")] public int GridOffsetX { get; set; }

    [JsonProperty("gridOffsetY")] public int GridOffsetY { get; set; }

    [JsonProperty("gridSizeX")] public int GridSizeX { get; set; }

    [JsonProperty("gridSizeY")] public int GridSizeY { get; set; }

    [JsonProperty("cellSize")] public int CellSize { get; set; }

    [JsonProperty("pixelsPerCell")] public int PixelsPerCell { get; set; }

    [JsonProperty("pixelsPerUnit")] public float PixelsPerUnit { get; set; }

    [JsonProperty("minCellX")] public int MinCellX { get; set; }

    [JsonProperty("minCellY")] public int MinCellY { get; set; }

    [JsonProperty("maxCellX")] public int MaxCellX { get; set; }

    [JsonProperty("maxCellY")] public int MaxCellY { get; set; }

    /// <summary>The lighting the capture established, never the lighting it found.</summary>
    [JsonProperty("sunIntensity")] public float SunIntensity { get; set; }

    [JsonProperty("sunEuler")] public string SunEuler { get; set; } = "";

    [JsonProperty("ambient")] public string Ambient { get; set; } = "";

    [JsonProperty("fog")] public bool Fog { get; set; }

    [JsonProperty("cameraHeight")] public float CameraHeight { get; set; }

    [JsonProperty("cullingMask")] public int CullingMask { get; set; }

    [JsonProperty("pinnedTime")] public string PinnedTime { get; set; } = "not-changed";

    [JsonProperty("pinnedWeather")] public string PinnedWeather { get; set; } = "not-changed";
}

/// <summary>One capture of one map.</summary>
public sealed class MapCaptureSnapshot
{
    [JsonProperty("inputs")] public MapCaptureInputs Inputs { get; set; } = new();

    [JsonProperty("tiles")] public List<MapCaptureTileSnapshot> Tiles { get; set; } = new();

    /// <summary>The cell scenes loaded while the capture ran, in load order.</summary>
    [JsonProperty("loadedCells")] public List<string> LoadedCells { get; set; } = new();

    /// <summary>
    /// True when the capture restored everything it changed.
    /// </summary>
    /// <remarks>
    /// A capture creates a light, clears fog, and instantiates a distant prefab for a cell with no
    /// authored scene, because with a save loaded elsewhere no overworld geometry streams at all.
    /// Each is undone. The controller fails the phase when this is false.
    /// </remarks>
    [JsonProperty("restored")] public bool Restored { get; set; } = true;

    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; set; } = new();
}
