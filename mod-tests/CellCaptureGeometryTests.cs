using System;
using System.Linq;
using ArdenfallCompendium.Entities.Map;
using Xunit;

namespace ArdenfallCompendium.Tests;

public class CellCaptureGeometryTests
{
    [Fact]
    public void FramesACellOverItsDeclaredRectangle()
    {
        // The overworld declares 150-unit cells with no offset, which the all-water cell -5.-10
        // confirmed by reporting renderer bounds of exactly 150 by 150.
        var frame = CellCaptureGeometry.Frame(-2, -8, 150, 512);

        Assert.Equal(-225f, frame.CenterX);
        Assert.Equal(-1125f, frame.CenterZ);
        Assert.Equal(75f, frame.OrthographicSize);
    }

    [Fact]
    public void CoversAnInclusiveRangeInRowMajorOrder()
    {
        var frames = CellCaptureGeometry.Frames(-1, 0, 0, 1, 150, 512);

        Assert.Equal(4, frames.Count);
        Assert.Equal(new[] { (-1, 0), (0, 0), (-1, 1), (0, 1) }, frames.Select(f => (f.CellX, f.CellY)).ToArray());
    }

    [Theory]
    [InlineData(150, 512, 3.4133333f)]
    [InlineData(150, 1024, 6.826667f)]
    [InlineData(600, 512, 0.85333335f)]
    public void PricesTheCaptureInPixelsPerUnit(int cellSize, int pixels, float expected) =>
        Assert.Equal(expected, CellCaptureGeometry.PixelsPerUnit(cellSize, pixels), 4);

    [Fact]
    public void PlacesAWorldPositionInItsCell()
    {
        // A position on a cell boundary belongs to the cell it starts, and a negative coordinate
        // floors away from zero rather than truncating towards it.
        Assert.Equal((-2, -8), CellCaptureGeometry.CellOf(-225f, -1125f, 150));
        Assert.Equal((-2, -8), CellCaptureGeometry.CellOf(-300f, -1200f, 150));
        Assert.Equal((-1, -7), CellCaptureGeometry.CellOf(-150f, -1050f, 150));
    }

    [Fact]
    public void RecordsGridCameraAndLightingInputs()
    {
        var inputs = CellCapture.Inputs(
            "overworld",
            "0.0.10.91",
            new MapCaptureGrid(-18, -10, 25, 23, 150),
            512,
            -2,
            -8,
            -2,
            -8,
            800f,
            123);

        Assert.Equal("overworld", inputs.MapId);
        Assert.Equal("0.0.10.91", inputs.GameVersion);
        Assert.Equal((-18, -10), (inputs.GridOffsetX, inputs.GridOffsetY));
        Assert.Equal((25, 23), (inputs.GridSizeX, inputs.GridSizeY));
        Assert.Equal(150, inputs.CellSize);
        Assert.Equal(512, inputs.PixelsPerCell);
        Assert.Equal(512f / 150f, inputs.PixelsPerUnit, 4);
        Assert.Equal(1.2f, inputs.SunIntensity);
        Assert.Equal("(50.0, 330.0, 0.0)", inputs.SunEuler);
        Assert.False(inputs.Fog);
        Assert.Equal(123, inputs.CullingMask);
    }

    [Fact]
    public void RefusesAnEmptyOrInvertedRange()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CellCaptureGeometry.Frame(0, 0, 0, 512));
        Assert.Throws<ArgumentOutOfRangeException>(() => CellCaptureGeometry.Frame(0, 0, 150, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => CellCaptureGeometry.Frames(1, 0, 0, 0, 150, 512));
    }
}
