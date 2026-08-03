using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
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
        return ExtractorLifecycle.Run(
            _source.EnumerateStatusEffects(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "statusEffectAssetMissing",
                Field = "id",
                Message = "StatusEffectData asset source yielded a null row",
            },
            asset =>
            {
                if (string.IsNullOrWhiteSpace(asset.Guid))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "lookupAssetGuidMissing",
                        Field = "id",
                        Message = $"StatusEffectData asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) =>
            {
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
                return new StatusEffectSnapshotRow
                {
                    Id = id,
                    Fields = new StatusEffectSnapshot(
                        Id: id,
                        StatusEffectName: statusEffectName,
                        TooltipSource: NullIfEmpty(asset.TooltipSource),
                        IconRef: iconRef,
                        IsHostile: asset.IsHostile),
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
