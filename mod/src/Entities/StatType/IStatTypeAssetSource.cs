using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
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

public sealed class LoadedStatTypeAssetSource : IStatTypeAssetSource
{
    private readonly Func<IEnumerable<Ardenfall.StatType>> _loadedStatTypes;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;
    private readonly Func<UnityObject, bool> _isAuthoredAsset;

    public LoadedStatTypeAssetSource()
        : this(
            loadedStatTypes: () => UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.StatType>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName,
            isAuthoredAsset: IsAuthoredAsset)
    {
    }

    public LoadedStatTypeAssetSource(
        Func<IEnumerable<Ardenfall.StatType>> loadedStatTypes,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string>? assetName = null,
        Func<UnityObject, bool>? isAuthoredAsset = null)
    {
        _loadedStatTypes = loadedStatTypes;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
        _isAuthoredAsset = isAuthoredAsset ?? IsAuthoredAsset;
    }

    public IEnumerable<StatTypeAsset> EnumerateStatTypes()
    {
        var seen = new HashSet<Ardenfall.StatType>(UnityObjectReferenceComparer<Ardenfall.StatType>.Instance);
        var assets = new List<Ardenfall.StatType>();
        foreach (var asset in _loadedStatTypes())
        {
            if (_isUnityNull(asset) || !_isAuthoredAsset(asset) || !seen.Add(asset)) continue;
            assets.Add(asset);
        }

        foreach (var asset in assets
                     .Select(asset => ToAsset(asset))
                     .OrderBy(asset => asset.AssetName, StringComparer.Ordinal))
        {
            yield return asset;
        }
    }

    private StatTypeAsset ToAsset(Ardenfall.StatType asset) => new(
        Guid: null,
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

    private static bool IsAuthoredAsset(UnityObject asset)
    {
        try
        {
            return (asset.hideFlags & UnityEngine.HideFlags.DontSave) == 0;
        }
        catch
        {
            return false;
        }
    }

}
