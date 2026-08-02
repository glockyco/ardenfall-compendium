using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Spell;

public sealed class SpellExtractor : WalkerBase<SpellSnapshotRow>
{
    private readonly ISpellAssetSource _source;

    public SpellExtractor()
        : this(new LoadedSpellAssetSource())
    {
    }

    public SpellExtractor(ISpellAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<SpellSnapshotRow> Walk()
    {
        var seenNames = new HashSet<string>(System.StringComparer.Ordinal);
        foreach (var asset in _source.EnumerateSpells())
        {
            if (asset == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "spellAssetMissing",
                    Field = "id",
                    Message = "SpellData asset source yielded a null row",
                });
                continue;
            }

            // The asset name is identity. A missing or duplicate value cannot address a row.
            var assetName = asset.AssetName ?? "";
            if (!NamedAssetIdentity.TryCreate("spell", assetName, out var id))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "namedAssetNameMissing",
                    Field = "id",
                    Message = $"SpellData asset has empty or whitespace name '{assetName}'",
                });
                continue;
            }
            if (!seenNames.Add(assetName))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "namedAssetNameDuplicate",
                    Field = "id",
                    Message = $"SpellData asset name '{assetName}' is duplicated",
                });
                continue;
            }

            // The display name is presentation. A missing value remains reportable without dropping the row.
            var spellName = NullIfEmpty(asset.SpellName);
            if (spellName == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "spellNameMissing",
                    Field = "spellName",
                    Message = $"SpellData '{id}' has empty or whitespace spellName",
                });
            }

            var statTypeRef = ReferenceEquals(asset.StatType, null)
                ? null
                : Refs.ResolveAsset(
                    asset.StatType,
                    "statTypeRef",
                    id,
                    MissingPolicy.OptionalEmpty,
                    "SpellData.statType");
            var iconRef = ReferenceEquals(asset.Icon, null)
                ? null
                : Refs.ResolveAsset(
                    asset.Icon,
                    "iconRef",
                    id,
                    MissingPolicy.OptionalEmpty,
                    "SpellData.icon");

            yield return new SpellSnapshotRow
            {
                Id = id,
                Fields = new SpellSnapshot(
                    Id: id,
                    SpellName: spellName,
                    StatTypeRef: statTypeRef,
                    ManaCost: asset.ManaCost,
                    IsIllegal: asset.IsIllegal,
                    IconRef: iconRef),
            };
        }
        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}

