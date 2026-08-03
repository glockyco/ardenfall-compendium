using ArdenfallCompendium.Assets;
using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.StatType;

public sealed class LoadedStatTypeAssetSource : IStatTypeAssetSource, IIconAssetPlanSink
{
    private IconAssetPlan? _assetPlan;
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

    public void AttachAssetPlan(IconAssetPlan? assetPlan) => _assetPlan = assetPlan;

    public IEnumerable<StatTypeAsset> EnumerateStatTypes()
    {
        var seen = new HashSet<Ardenfall.StatType>(UnityObjectReferenceComparer<Ardenfall.StatType>.Instance);
        var assets = new List<Ardenfall.StatType>();
        foreach (var asset in _loadedStatTypes())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }
            if (!_isAuthoredAsset(asset) || !seen.Add(asset)) continue;
            assets.Add(asset);
        }

        foreach (var asset in assets
                     .Select(ToAsset)
                     .OrderBy(asset => asset.AssetName, StringComparer.Ordinal))
        {
            yield return asset;
        }
    }

    private StatTypeAsset ToAsset(Ardenfall.StatType asset)
    {
        var assetName = _assetName(asset);
        if (_assetPlan != null && NamedAssetIdentity.TryCreate("stat-type", assetName, out var id))
        {
            if (asset.icon is UnityEngine.Sprite sprite)
            {
                _assetPlan.Slots.Add(new IconAssetSlot("stat-type", id, "iconRef", sprite, "stat-type"));
            }
        }
        return new StatTypeAsset(
            Guid: null,
            AssetName: _assetName(asset),
            IsAttribute: asset.isAttribute,
            StatName: asset.statName,
            IconRef: asset.icon == null
                ? null
                : SnapshotRef.Missing("engineResource", "StatType.icon"),
            IconColor: AssetColorSnapshot.FromColor(asset.iconColor),
            StatDescription: asset.statDescription,
            LongStatDescription: asset.longStatDescription,
            Affects: asset.affects,
            SkillAffects: asset.skillAffects);
    }

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("StatType lookup failed for field 'name'.", exception);
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("StatType lookup failed for field 'asset'.", exception);
        }
    }

    private static bool IsAuthoredAsset(UnityObject asset)
    {
        try
        {
            return (asset.hideFlags & UnityEngine.HideFlags.DontSave) == 0;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("StatType lookup failed for field 'hideFlags'.", exception);
        }
    }
}
