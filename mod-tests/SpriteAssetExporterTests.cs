using ArdenfallCompendium.Assets;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class SpriteAssetExporterTests
{
    [Fact]
    public void CropRgbaUsesRectPixelsInsteadOfWholeTexture()
    {
        var rgba = new byte[]
        {
            255, 0, 0, 255,     0, 255, 0, 255,
            0, 0, 255, 255,     255, 255, 0, 255,
        };

        var crop = SpriteAssetExporter.CropRgba(rgba, textureWidth: 2, textureHeight: 2, x: 1, y: 0, width: 1, height: 2);

        Assert.Equal(new byte[] { 0, 255, 0, 255, 255, 255, 0, 255 }, crop);
    }

    [Fact]
    public void Sha256HexIsContentStable()
    {
        var hash = SpriteAssetExporter.Sha256Hex(new byte[] { 1, 2, 3 });

        Assert.Equal("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81", hash);
    }
}
