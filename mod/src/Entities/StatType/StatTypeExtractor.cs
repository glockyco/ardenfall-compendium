using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Walker;
using UnityEngine;

namespace ArdenfallCompendium.Entities.StatType;

public sealed class StatTypeExtractor : WalkerBase<StatTypeSnapshotRow>
{
    private readonly IStatTypeAssetSource _source;
    private readonly ItemIconAssetPlan? _assetPlan;

    public StatTypeExtractor()
        : this(new LoadedStatTypeAssetSource(), assetPlan: null)
    {
    }

    public StatTypeExtractor(IStatTypeAssetSource source, ItemIconAssetPlan? assetPlan = null)
    {
        _source = source;
        _assetPlan = assetPlan;
    }

    public override IEnumerable<StatTypeSnapshotRow> Walk()
    {
        var seenNames = new HashSet<string>(System.StringComparer.Ordinal);
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
            asset => CreateIdentity(asset, seenNames),
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

                var iconRef = Refs.ResolveAsset(
                    asset.Icon!,
                    "iconRef",
                    id,
                    MissingPolicy.Diagnostic,
                    "StatType.icon");

                if (_assetPlan != null && asset.Icon is Sprite sprite)
                {
                    _assetPlan.Slots.Add(new ItemIconAssetSlot("stat-type", id, "iconRef", sprite, "stat-type"));
                }
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

    private static ExtractorIdentity CreateIdentity(StatTypeAsset asset, HashSet<string> seenNames)
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
        if (!seenNames.Add(assetName))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameDuplicate",
                Field = "id",
                Message = $"StatType asset name '{assetName}' is duplicated",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
