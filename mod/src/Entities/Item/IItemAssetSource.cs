using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Item;

public sealed record ItemAsset(
    string? Guid,
    string AssetName,
    ItemSnapshotRow? Snapshot,
    IReadOnlyList<Diagnostic>? Diagnostics = null);

public interface IItemAssetSource
{
    IEnumerable<ItemAsset> EnumerateItems();
}
