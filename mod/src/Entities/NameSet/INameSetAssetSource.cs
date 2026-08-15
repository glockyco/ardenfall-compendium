using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.NameSet;

public sealed record NameSetSeedAsset(
    string? Name,
    int Weight);

public sealed record NameSetAsset(
    string AssetName,
    IReadOnlyList<NameSetSeedAsset>? Seeds,
    int GenerationOrder);

public interface INameSetAssetSource
{
    IEnumerable<NameSetAsset> EnumerateNameSets();
}
