using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.ItemTag;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemTagExtractorTests
{
    [Fact]
    public void ExtractsEveryTagWithDescription()
    {
        var source = new FakeItemTagAssetSource(new[]
        {
            FakeItemTagAssetSource.Build(
                guid: "tag-valuable-remedy",
                assetName: "valuable-remedy",
                tagName: "Valuable remedy",
                description: "Incredibly valuable remedy"),
            FakeItemTagAssetSource.Build(
                guid: "tag-rare",
                assetName: "rare",
                tagName: null,
                description: null),
        });
        var extractor = new ItemTagExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Equal(2, rows.Count);
        Assert.Equal("tag-valuable-remedy", rows[0].Id);
        Assert.Equal("Valuable remedy", rows[0].Fields.TagName);
        Assert.Equal("Incredibly valuable remedy", rows[0].Fields.Description);
        Assert.Equal("", rows[1].Fields.Description);
        Assert.Contains(extractor.Diagnostics, diagnostic =>
            diagnostic.Code == "itemTagNameMissing" && diagnostic.Field == "tagName");
    }

    [Fact]
    public void DiagnosesAssetMissingGuid()
    {
        var source = new FakeItemTagAssetSource(new[]
        {
            FakeItemTagAssetSource.BuildWithoutGuid("Floating Tag"),
        });
        var extractor = new ItemTagExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    [Fact]
    public void DiagnosesEmptyGuid()
    {
        var source = new FakeItemTagAssetSource(new[]
        {
            FakeItemTagAssetSource.Build(
                guid: "",
                assetName: "empty-guid-tag",
                tagName: "Empty GUID",
                description: "Dropped because item refs drop empty GUIDs"),
        });
        var extractor = new ItemTagExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    [Fact]
    public void DiagnosesWhitespaceGuid()
    {
        var source = new FakeItemTagAssetSource(new[]
        {
            FakeItemTagAssetSource.Build(
                guid: "   ",
                assetName: "whitespace-guid-tag",
                tagName: "Whitespace GUID",
                description: "Preserved because item refs preserve non-empty GUID strings"),
        });
        var extractor = new ItemTagExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    private sealed class FakeItemTagAssetSource : IItemTagAssetSource
    {
        private readonly IReadOnlyList<ItemTagAsset> _assets;

        public FakeItemTagAssetSource(IReadOnlyList<ItemTagAsset> assets)
        {
            _assets = assets;
        }

        public IEnumerable<ItemTagAsset> EnumerateItemTags() => _assets;

        public static ItemTagAsset Build(
            string guid,
            string assetName,
            string? tagName,
            string? description) => new(
                Guid: guid,
                AssetName: assetName,
                TagName: tagName,
                Description: description);

        public static ItemTagAsset BuildWithoutGuid(string assetName) => new(
            Guid: null,
            AssetName: assetName,
            TagName: assetName,
            Description: null);
    }
}
