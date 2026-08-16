using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.CharacterRace;

public sealed record CharacterRaceAsset(
    string AssetName,
    string? RaceName,
    IReadOnlyList<string?>? NameSetAssetNames,
    SnapshotRef? ParentRef = null,
    string RaceNameProvenance = "absent",
    string? RaceNameOwner = null);

public interface ICharacterRaceAssetSource
{
    IEnumerable<CharacterRaceAsset> EnumerateCharacterRaces();
}
