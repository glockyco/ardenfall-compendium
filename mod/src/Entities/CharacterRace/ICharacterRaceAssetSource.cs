using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.CharacterRace;

public sealed record CharacterRaceAsset(
    string AssetName,
    string? RaceName,
    IReadOnlyList<string?>? NameSetAssetNames);

public interface ICharacterRaceAssetSource
{
    IEnumerable<CharacterRaceAsset> EnumerateCharacterRaces();
}
