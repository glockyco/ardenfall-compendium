using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Location;

public sealed record LocationAssetRecord(
    string? Guid,
    string AssetName,
    bool Enabled,
    string? LocationName,
    string? GameLocationId,
    SnapshotRef? MapRef,
    string? MapId,
    bool ShowOnMap,
    bool ShowOnMapDebugOnly,
    SnapshotRef? IconRef,
    LocationVector3Snapshot MapPosition,
    bool AllowFastTravel,
    LocationVector3Snapshot? FastTravelPosition,
    bool DisplayOnEnterVolume,
    IReadOnlyList<LocationVolumeSnapshot> Volumes);

public interface ILocationAssetSource
{
    IEnumerable<LocationAssetRecord> EnumerateLocations();
}

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
            if (_isUnityNull(asset)) continue;
            if (!asset.enabled) continue;
            yield return ToRecord(asset, _lookupGuid, _assetName);
        }
    }

    private static LocationAssetRecord ToRecord(
        LocationAsset asset,
        Func<UnityObject, string?> lookupGuid,
        Func<UnityObject, string> assetName)
    {
        var assetGuid = lookupGuid(asset);
        return new LocationAssetRecord(
            Guid: assetGuid,
            AssetName: assetName(asset),
            Enabled: asset.enabled,
            LocationName: asset.locationName,
            GameLocationId: asset.locationID,
            MapRef: ResolveAsset(asset.map, lookupGuid, assetName, "LocationAsset.map"),
            MapId: asset.map == null ? null : asset.map.id,
            ShowOnMap: asset.showOnMap,
            ShowOnMapDebugOnly: asset.showOnMapDebugOnly,
            IconRef: ResolveAsset(asset.icon, lookupGuid, assetName, "LocationAsset.icon"),
            MapPosition: FromVector3(asset.mapPosition),
            AllowFastTravel: asset.allowFastTravel,
            FastTravelPosition: asset.allowFastTravel ? FromVector3(asset.fastTravelPosition) : null,
            DisplayOnEnterVolume: asset.displayOnEnterVolume,
            Volumes: asset.volumes
                .Select((volume, index) =>
                    new LocationVolumeSnapshot(index, FromVector3(volume.center), FromVector3(volume.size)))
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
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, assetName(asset));
    }

    private static LocationVector3Snapshot FromVector3(Vector3 value) => new(value.x, value.y, value.z);

    private static bool IsUnityNull(UnityObject? asset)
    {
        try
        {
            return asset == null;
        }
        catch (MissingReferenceException)
        {
            return true;
        }
    }

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (MissingReferenceException)
        {
            return "";
        }
    }

    private static string? LookupGuid(UnityObject asset)
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) return null;
        var guid = lookup.GetGuid(asset);
        return string.IsNullOrWhiteSpace(guid) ? null : guid;
    }
}
