using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Character;

public sealed record CharacterAsset(
    string AssetName,
    string? CharacterName,
    IReadOnlyList<SnapshotRef>? ItemRefs,
    IReadOnlyList<SnapshotRef>? AdditionalItemRefs,
    IReadOnlyList<SnapshotRef>? StartingFactions = null);

public interface ICharacterAssetSource
{
    IEnumerable<CharacterAsset> EnumerateCharacters();
}
