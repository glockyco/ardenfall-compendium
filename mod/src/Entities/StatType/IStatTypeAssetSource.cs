using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.StatType;

public sealed record StatTypeAsset(
    string? Guid,
    string AssetName,
    bool IsAttribute,
    string? StatName,
    Object? Icon,
    AssetColorSnapshot IconColor,
    string? StatDescription,
    string? LongStatDescription,
    IReadOnlyList<string>? Affects,
    IReadOnlyList<string>? SkillAffects);

public interface IStatTypeAssetSource
{
    IEnumerable<StatTypeAsset> EnumerateStatTypes();
}

public sealed class BuiltLookupTableStatTypeAssetSource : IStatTypeAssetSource
{
    public IEnumerable<StatTypeAsset> EnumerateStatTypes()
    {
        var lookup = BuiltLookupTable.Instance;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<Ardenfall.StatType>())
        {
            if (asset == null) continue;
            yield return new StatTypeAsset(
                Guid: lookup?.GetGuid(asset),
                AssetName: asset.name ?? "",
                IsAttribute: asset.isAttribute,
                StatName: asset.statName,
                Icon: asset.icon,
                IconColor: AssetColorSnapshot.FromColor(asset.iconColor),
                StatDescription: asset.statDescription,
                LongStatDescription: asset.longStatDescription,
                Affects: asset.affects,
                SkillAffects: asset.skillAffects);
        }
    }
}
