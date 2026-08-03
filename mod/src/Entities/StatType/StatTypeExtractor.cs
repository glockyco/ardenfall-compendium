using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using UnityEngine;

namespace ArdenfallCompendium.Entities.StatType;

public sealed class StatTypeExtractor : WalkerBase<StatTypeSnapshotRow>
{
    private readonly IStatTypeAssetSource _source;
    private readonly IconAssetPlan? _assetPlan;

    public StatTypeExtractor()
        : this(new LoadedStatTypeAssetSource(), assetPlan: null)
    {
    }

    public StatTypeExtractor(IStatTypeAssetSource source, IconAssetPlan? assetPlan = null)
    {
        _source = source;
        _assetPlan = assetPlan;
        if (source is IIconAssetPlanSink sink) sink.AttachAssetPlan(assetPlan);
    }

    public override IEnumerable<StatTypeSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateStatTypes(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "statTypeAssetMissing",
                Field = "id",
                Message = "StatType asset source yielded a null row",
            },
            asset => CreateIdentity(asset),
            (asset, id) =>
            {
                var statName = NullIfEmpty(asset.StatName);
                if (statName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "statTypeNameMissing",
                        Field = "statName",
                        Message = $"StatType '{id}' has empty or whitespace statName",
                    });
                }

                var iconRef = asset.IconRef;

                return new StatTypeSnapshotRow
                {
                    Id = id,
                    Fields = new StatTypeSnapshot(
                        Id: id,
                        IsAttribute: asset.IsAttribute,
                        StatName: statName,
                        IconRef: iconRef,
                        IconColor: asset.IconColor,
                        StatDescription: NullIfEmpty(asset.StatDescription),
                        LongStatDescription: NullIfEmpty(asset.LongStatDescription),
                        Affects: asset.Affects?.ToList() ?? new List<string>(),
                        SkillAffects: asset.SkillAffects?.ToList() ?? new List<string>()),
                };
            });
    }

    private static ExtractorIdentity CreateIdentity(StatTypeAsset asset)
    {
        var assetName = asset.AssetName ?? "";
        if (!NamedAssetIdentity.TryCreate("stat-type", assetName, out var id))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameMissing",
                Field = "id",
                Message = $"StatType asset has empty or whitespace name '{assetName}'",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
