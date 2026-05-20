using System.Collections.Generic;
using Ardenfall;
using ArdenfallTag = Ardenfall.Item.ItemTag;

namespace ArdenfallCompendium.Entities.ItemTag;

public sealed record ItemTagAsset(
    string? Guid,
    string AssetName,
    string? TagName,
    string? Description);

public interface IItemTagAssetSource
{
    IEnumerable<ItemTagAsset> EnumerateItemTags();
}

public sealed class BuiltLookupTableItemTagAssetSource : IItemTagAssetSource
{
    public IEnumerable<ItemTagAsset> EnumerateItemTags()
    {
        var lookup = BuiltLookupTable.Instance;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<ArdenfallTag>())
        {
            if (asset == null) continue;
            yield return new ItemTagAsset(
                Guid: lookup?.GetGuid(asset),
                AssetName: asset.name ?? "",
                TagName: asset.tagName,
                Description: asset.description);
        }
    }
}
