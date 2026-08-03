using System.Runtime.CompilerServices;
using ArdenfallCompendium.Assets;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class SpriteAssetExporterTests
{
    // A 2x2 texture in Unity's layout. Row 0 is the bottom of the picture, so the first two
    // pixels here are the bottom row and the last two are the top row.
    private static readonly byte[] Texture =
    [
        255, 0, 0, 255,     0, 255, 0, 255,
        0, 0, 255, 255,     255, 255, 0, 255,
    ];

    [Fact]
    public void CropRgbaUsesRectPixelsInsteadOfWholeTexture()
    {
        var crop = SpriteAssetExporter.CropRgba(Texture, textureWidth: 2, textureHeight: 2, x: 1, y: 0, width: 1, height: 2);

        // The right-hand column, top row first, because a PNG starts at the top left.
        Assert.Equal(new byte[] { 255, 255, 0, 255, 0, 255, 0, 255 }, crop);
    }

    [Fact]
    public void CropRgbaTurnsUnityRowsTheRightWayUp()
    {
        // Unity reads a texture from the bottom left and a PNG starts at the top left, so a
        // crop that keeps the source row order publishes every picture upside down. This
        // asserts the first output row is the last source row, which is what catches it.
        var crop = SpriteAssetExporter.CropRgba(Texture, textureWidth: 2, textureHeight: 2, x: 0, y: 0, width: 2, height: 2);

        Assert.Equal(
            new byte[]
            {
                0, 0, 255, 255,     255, 255, 0, 255,
                255, 0, 0, 255,     0, 255, 0, 255,
            },
            crop);
    }

    [Fact]
    public void FailedIconExportProducesEntityFieldDiagnostic()
    {
        var plan = new IconAssetPlan();
        plan.Slots.Add(new IconAssetSlot(
            "spell",
            "named;spell;broken",
            "iconRef",
            (UnityEngine.Sprite)RuntimeHelpers.GetUninitializedObject(typeof(UnityEngine.Sprite)),
            "spell",
            "SpellData.icon"));

        new IconAssetManifestWriter(new SpriteAssetExporter()).WriteSlots("", plan);

        var diagnostic = Assert.Single(plan.Diagnostics);
        Assert.Equal("assetExportFailed", diagnostic.Code);
        Assert.Equal("iconRef", diagnostic.Field);
        Assert.Contains("spell", diagnostic.Message);
        Assert.Contains("named;spell;broken", diagnostic.Message);
        Assert.Contains("SpellData.icon", diagnostic.Message);
    }
    [Fact]
    public void Sha256HexIsContentStable()
    {
        var hash = SpriteAssetExporter.Sha256Hex(new byte[] { 1, 2, 3 });

        Assert.Equal("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81", hash);
    }
}
