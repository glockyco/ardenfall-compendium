using System;
using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.Map;

/// <summary>One cell of a map's declared grid, and the camera that covers it exactly.</summary>
public readonly struct CellCaptureFrame
{
    public CellCaptureFrame(int cellX, int cellY, float centerX, float centerZ, float orthographicSize, int pixels)
    {
        CellX = cellX;
        CellY = cellY;
        CenterX = centerX;
        CenterZ = centerZ;
        OrthographicSize = orthographicSize;
        Pixels = pixels;
    }

    public int CellX { get; }

    public int CellY { get; }

    public float CenterX { get; }

    public float CenterZ { get; }

    /// <summary>Half the cell's world size, which is what an orthographic camera takes.</summary>
    public float OrthographicSize { get; }

    public int Pixels { get; }
}

/// <summary>
/// Where a capture points its camera, derived from the map's declared grid.
/// </summary>
/// <remarks>
/// Bounds never come from the content of a cell scene. Cell `-2.-8` of the overworld reports
/// renderer bounds of 1,339 by 504 units, because a cell scene parents distant geometry far outside
/// its own rectangle, while the declared grid is exact: a cell spans <c>index * cellSize</c> to
/// <c>(index + 1) * cellSize</c> on both axes with no offset. The all-water cell `-5.-10` confirmed
/// it by reporting renderer bounds of exactly 150 by 150.
/// </remarks>
public static class CellCaptureGeometry
{
    /// <summary>The camera frame for one cell of a grid whose cells are <paramref name="cellSize"/> units.</summary>
    public static CellCaptureFrame Frame(int cellX, int cellY, int cellSize, int pixels)
    {
        if (cellSize <= 0) throw new ArgumentOutOfRangeException(nameof(cellSize), "cell size must be positive");
        if (pixels <= 0) throw new ArgumentOutOfRangeException(nameof(pixels), "pixels must be positive");

        return new CellCaptureFrame(
            cellX,
            cellY,
            (cellX + 0.5f) * cellSize,
            (cellY + 0.5f) * cellSize,
            cellSize / 2f,
            pixels);
    }

    /// <summary>Every frame of an inclusive cell range, in row-major order.</summary>
    public static IReadOnlyList<CellCaptureFrame> Frames(
        int minCellX,
        int minCellY,
        int maxCellX,
        int maxCellY,
        int cellSize,
        int pixels)
    {
        if (maxCellX < minCellX) throw new ArgumentOutOfRangeException(nameof(maxCellX), "max cell x precedes min");
        if (maxCellY < minCellY) throw new ArgumentOutOfRangeException(nameof(maxCellY), "max cell y precedes min");

        var frames = new List<CellCaptureFrame>();
        for (var y = minCellY; y <= maxCellY; y++)
        {
            for (var x = minCellX; x <= maxCellX; x++)
            {
                frames.Add(Frame(x, y, cellSize, pixels));
            }
        }

        return frames;
    }

    /// <summary>Pixels per world unit, which is the number the tile pyramid is priced in.</summary>
    public static float PixelsPerUnit(int cellSize, int pixels) => cellSize <= 0 ? 0f : (float)pixels / cellSize;

    /// <summary>The cell a world position falls in, so a placement can be checked against the capture.</summary>
    public static (int X, int Y) CellOf(float worldX, float worldZ, int cellSize) =>
        ((int)Math.Floor(worldX / cellSize), (int)Math.Floor(worldZ / cellSize));
}
