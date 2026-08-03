using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Location;

public sealed class BuiltLookupTableLocationAssetSource : ILocationAssetSource
{
    private readonly Func<IEnumerable<LocationAsset>> _lookupLocations;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string?> _lookupGuid;
    private readonly Func<UnityObject, string> _assetName;

    public BuiltLookupTableLocationAssetSource()
        : this(
            lookupLocations: () => BuiltLookupTable.GetAssetsOfType<LocationAsset>(),
            isUnityNull: IsUnityNull,
            lookupGuid: LookupGuid,
            assetName: SafeName)
    {
    }

    public BuiltLookupTableLocationAssetSource(
        Func<IEnumerable<LocationAsset>> lookupLocations,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string?>? lookupGuid = null,
        Func<UnityObject, string>? assetName = null)
    {
        _lookupLocations = lookupLocations;
        _isUnityNull = isUnityNull;
        _lookupGuid = lookupGuid ?? LookupGuid;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<LocationAssetRecord> EnumerateLocations()
    {
        foreach (var asset in _lookupLocations())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }
            if (!asset.enabled) continue;
            yield return ToRecord(asset, _lookupGuid, _assetName);
        }
    }

    private static LocationAssetRecord ToRecord(
        LocationAsset asset,
        Func<UnityObject, string?> lookupGuid,
        Func<UnityObject, string> assetName)
    {
        var map = ResolveAsset(asset.map, lookupGuid, assetName, "LocationAsset.map");
        var icon = ResolveAsset(asset.icon, lookupGuid, assetName, "LocationAsset.icon");
        return new LocationAssetRecord(
            Guid: lookupGuid(asset),
            AssetName: assetName(asset),
            Enabled: asset.enabled,
            LocationName: asset.locationName,
            MapRef: map,
            MapId: asset.map == null ? null : asset.map.id,
            ShowOnMap: asset.showOnMap,
            ShowOnMapDebugOnly: asset.showOnMapDebugOnly,
            IconRef: icon,
            MapPosition: FromVector3(asset.mapPosition),
            AllowFastTravel: asset.allowFastTravel,
            FastTravelPosition: asset.allowFastTravel ? FromVector3(asset.fastTravelPosition) : null,
            Volumes: asset.volumes == null
                ? null
                : asset.volumes
                    .Select((volume, index) => volume == null
                        ? null
                        : new LocationVolumeSnapshot(index, FromVector3(volume.center), FromVector3(volume.size)))
                    .ToList());
    }

    private static SnapshotRef ResolveAsset(
        UnityObject? asset,
        Func<UnityObject, string?> lookupGuid,
        Func<UnityObject, string> assetName,
        string source)
    {
        if (asset == null) return SnapshotRef.Missing("nullAsset", source);
        var guid = lookupGuid(asset);
        if (!string.IsNullOrWhiteSpace(guid)) return SnapshotRef.LookupAsset(guid, asset.GetType().FullName ?? asset.GetType().Name, assetName(asset));
        return SnapshotRef.Missing("lookupAssetGuidMissing", source);
    }

    private static LocationVector3Snapshot FromVector3(Vector3 value) => new(value.x, value.y, value.z);

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("LocationAsset lookup failed for field 'asset' because the Unity object was destroyed.", exception);
        }
    }

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("LocationAsset lookup failed for field 'name' because the Unity object was destroyed.", exception);
        }
    }

    private static string? LookupGuid(UnityObject asset) => BuiltLookupTable.Instance?.GetGuid(asset);
}
