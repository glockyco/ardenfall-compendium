using System.Collections.Generic;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Character;

public sealed record CharacterAsset(
    string AssetName,
    string? CharacterName,
    IReadOnlyList<CountedItemListAsset>? ItemLists,
    IReadOnlyList<CountedItemData>? AdditionalItems);

public interface ICharacterAssetSource
{
    IEnumerable<CharacterAsset> EnumerateCharacters();
}
