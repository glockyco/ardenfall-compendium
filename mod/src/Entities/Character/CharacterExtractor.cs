using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Character;

public sealed class CharacterExtractor : WalkerBase<CharacterSnapshotRow>
{
    private readonly ICharacterAssetSource _source;

    public CharacterExtractor()
        : this(new BuiltLookupTableCharacterAssetSource())
    {
    }

    public CharacterExtractor(ICharacterAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<CharacterSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateCharacters(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "characterAssetMissing",
                Field = "id",
                Message = "CharacterData asset source yielded a null row",
            },
            asset => CreateIdentity(asset),
            (asset, id) =>
            {
                var name = NullIfEmpty(asset.CharacterName);
                if (name == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "characterNameMissing",
                        Field = "name",
                        Message = $"CharacterData '{id}' has empty or whitespace stored charName",
                    });
                }

                if (asset.RaceRef == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "characterRaceMissing",
                        Field = "raceRef",
                        Message = $"CharacterData '{id}' has no resolved race",
                    });
                }

                var dropRefs = new List<SnapshotRef>();
                AddRefs(dropRefs, asset.ItemRefs);
                AddRefs(dropRefs, asset.AdditionalItemRefs);

                return new CharacterSnapshotRow
                {
                    Id = id,
                    Fields = new CharacterSnapshot(
                        id,
                        name,
                        dropRefs,
                        asset.StartingFactions == null
                            ? null
                            : new List<SnapshotRef>(asset.StartingFactions),
                        asset.ParentRef ?? SnapshotRef.Missing("noParent", "ParameterizedObject.parent"),
                        asset.RaceRef),
                };
            });
    }

    private static void AddRefs(List<SnapshotRef> target, IReadOnlyList<SnapshotRef>? refs)
    {
        if (refs == null) return;
        foreach (var reference in refs)
        {
            if (!target.Contains(reference)) target.Add(reference);
        }
    }

    private static ExtractorIdentity CreateIdentity(CharacterAsset asset)
    {
        var assetName = asset.AssetName ?? "";
        if (!NamedAssetIdentity.TryCreate("character", assetName, out var id))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameMissing",
                Field = "id",
                Message = $"CharacterData asset has empty or whitespace name '{assetName}'",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
