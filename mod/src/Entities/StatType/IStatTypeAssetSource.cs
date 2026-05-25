using System;
using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.StatType;

public sealed record StatTypeAsset(
    string? Guid,
    string AssetName,
    bool IsAttribute,
    string? StatName,
    UnityObject? Icon,
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
    private readonly Func<IEnumerable<Ardenfall.StatType>> _lookupStatTypes;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;

    public BuiltLookupTableStatTypeAssetSource()
        : this(
            lookupStatTypes: () => BuiltLookupTable.GetAssetsOfType<Ardenfall.StatType>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName)
    {
    }

    public BuiltLookupTableStatTypeAssetSource(
        Func<IEnumerable<Ardenfall.StatType>> lookupStatTypes,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string>? assetName = null)
    {
        _lookupStatTypes = lookupStatTypes;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<StatTypeAsset> EnumerateStatTypes()
    {
        foreach (var asset in _lookupStatTypes())
        {
            if (_isUnityNull(asset)) continue;
            yield return ToAsset(asset);
        }
    }

    private StatTypeAsset ToAsset(Ardenfall.StatType asset) => new(
        Guid: LookupGuid(asset),
        AssetName: _assetName(asset),
        IsAttribute: asset.isAttribute,
        StatName: asset.statName,
        Icon: asset.icon,
        IconColor: AssetColorSnapshot.FromColor(asset.iconColor),
        StatDescription: asset.statDescription,
        LongStatDescription: asset.longStatDescription,
        Affects: asset.affects,
        SkillAffects: asset.skillAffects);

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch
        {
            return "";
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch
        {
            return false;
        }
    }

    private static string? LookupGuid(UnityObject asset)
    {
        try
        {
            return BuiltLookupTable.Instance != null ? BuiltLookupTable.Instance.GetGuid(asset) : null;
        }
        catch
        {
            return null;
        }
    }

}
