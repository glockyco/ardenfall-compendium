using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed class StatusEffectExtractor : WalkerBase<StatusEffectSnapshotRow>
{
    private readonly IStatusEffectAssetSource _source;

    public StatusEffectExtractor()
        : this(new BuiltLookupTableStatusEffectAssetSource())
    {
    }

    public StatusEffectExtractor(IStatusEffectAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<StatusEffectSnapshotRow> Walk()
    {
        foreach (var asset in _source.EnumerateStatusEffects())
        {
            if (asset == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "statusEffectAssetMissing",
                    Field = "id",
                    Message = "StatusEffectData asset source yielded a null row",
                });
                continue;
            }

            var id = asset.Guid;
            if (string.IsNullOrWhiteSpace(id))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"StatusEffectData asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                });
                continue;
            }

            var statusEffectName = NullIfEmpty(asset.StatusEffectName);
            if (statusEffectName == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "statusEffectNameMissing",
                    Field = "statusEffectName",
                    Message = $"StatusEffectData '{id}' has empty or whitespace statusEffectName",
                });
            }

            var iconRef = ReferenceEquals(asset.Icon, null)
                ? null
                : Refs.ResolveAsset(
                    asset.Icon,
                    "iconRef",
                    id,
                    MissingPolicy.OptionalEmpty,
                    "StatusEffectData.statusEffectIcon");

            var tooltipSource = NullIfEmpty(asset.TooltipSource);

            yield return new StatusEffectSnapshotRow
            {
                Id = id,
                Fields = new StatusEffectSnapshot(
                    Id: id,
                    StatusEffectName: statusEffectName,
                    TooltipSource: tooltipSource,
                    IconRef: iconRef,
                    IsHostile: asset.IsHostile),
            };
        }

        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
