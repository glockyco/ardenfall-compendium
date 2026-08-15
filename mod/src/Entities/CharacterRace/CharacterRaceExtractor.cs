using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.CharacterRace;

public sealed class CharacterRaceExtractor : WalkerBase<CharacterRaceSnapshotRow>
{
    private readonly ICharacterRaceAssetSource _source;

    public CharacterRaceExtractor()
        : this(new LoadedCharacterRaceAssetSource())
    {
    }

    public CharacterRaceExtractor(ICharacterRaceAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<CharacterRaceSnapshotRow> Walk() =>
        ExtractorLifecycle.Run(
            _source.EnumerateCharacterRaces(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "characterRaceAssetMissing",
                Field = "id",
                Message = "CharacterRace asset source yielded a null row",
            },
            asset =>
            {
                var assetName = asset.AssetName ?? "";
                if (!NamedAssetIdentity.TryCreate("character-race", assetName, out var id))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "namedAssetNameMissing",
                        Field = "id",
                        Message = $"CharacterRace asset has empty or whitespace name '{assetName}'",
                    });
                }

                return ExtractorIdentity.Valid(id);
            },
            (asset, id) =>
            {
                var raceName = NullIfEmpty(asset.RaceName);
                if (raceName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "characterRaceNameMissing",
                        Field = "raceName",
                        Message = $"CharacterRace '{id}' has empty or whitespace raceName",
                    });
                }

                var nameSetRefs = new List<SnapshotRef>();
                var nameSetAssetNames = asset.NameSetAssetNames;
                if (nameSetAssetNames != null)
                {
                    for (var index = 0; index < nameSetAssetNames.Count; index++)
                    {
                        var nameSetAssetName = nameSetAssetNames[index];
                        if (string.IsNullOrWhiteSpace(nameSetAssetName))
                        {
                            Diagnostics.Add(new Diagnostic
                            {
                                Severity = "diagnostic",
                                Code = "characterRaceNameSetMissing",
                                Field = $"nameSetRefs[{index}]",
                                Message = $"CharacterRace '{id}' has a name set with no asset name at index {index}",
                            });
                            nameSetRefs.Add(SnapshotRef.Missing(
                                "namedAssetNameMissing",
                                "CharacterRace.nameSets"));
                            continue;
                        }

                        nameSetRefs.Add(SnapshotRef.NamedAsset("name-set", nameSetAssetName));
                    }
                }

                return new CharacterRaceSnapshotRow
                {
                    Id = id,
                    Fields = new CharacterRaceSnapshot(
                        Id: id,
                        RaceName: raceName,
                        NameSetRefs: nameSetRefs),
                };
            });

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
