using System.Collections.Generic;

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
