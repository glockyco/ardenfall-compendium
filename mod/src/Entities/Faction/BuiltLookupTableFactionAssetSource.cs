using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;
using GameFaction = Ardenfall.Faction;

namespace ArdenfallCompendium.Entities.Faction;

public sealed class BuiltLookupTableFactionAssetSource : IFactionAssetSource
{
    private readonly Func<IEnumerable<GameFaction>> _lookupFactions;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string?> _lookupGuid;
    private readonly Func<UnityObject, string> _assetName;

    public BuiltLookupTableFactionAssetSource()
        : this(
            lookupFactions: () => BuiltLookupTable.GetAssetsOfType<GameFaction>(),
            isUnityNull: IsUnityNull,
            lookupGuid: LookupGuid,
            assetName: SafeName)
    {
    }

    public BuiltLookupTableFactionAssetSource(
        Func<IEnumerable<GameFaction>> lookupFactions,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string?>? lookupGuid = null,
        Func<UnityObject, string>? assetName = null)
    {
        _lookupFactions = lookupFactions;
        _isUnityNull = isUnityNull;
        _lookupGuid = lookupGuid ?? LookupGuid;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<FactionAssetRecord> EnumerateFactions()
    {
        foreach (var asset in _lookupFactions())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }
            yield return ToRecord(asset, _lookupGuid, _assetName);
        }
    }

    private static FactionAssetRecord ToRecord(
        GameFaction asset,
        Func<UnityObject, string?> lookupGuid,
        Func<UnityObject, string> assetName)
    {
        var relationships = asset.interFactionRelationships == null
            ? null
            : asset.interFactionRelationships
                .Select(relationship => relationship == null
                    ? null
                    : new FactionRelationshipRecord(
                        Faction: ResolveAsset(relationship.faction, lookupGuid, assetName, "Faction.interFactionRelationships.faction"),
                        Relationship: relationship.relationship,
                        IsEnemy: relationship.isEnemy))
                .ToList();

        return new FactionAssetRecord(
            Guid: lookupGuid(asset),
            AssetName: assetName(asset),
            Title: asset.title,
            FactionId: asset.id,
            Description: asset.description,
            IconRef: ResolveAsset(asset.icon, lookupGuid, assetName, "Faction.icon"),
            Alliable: asset.alliable,
            EnableReputation: asset.enableReputation,
            AlwaysShowInUI: asset.alwaysShowInUI,
            CanBeDisguised: asset.canBeDisguised,
            EnableBounty: asset.enableBounty,
            InterFactionRelationships: relationships);
    }

    private static SnapshotRef? ResolveAsset(
        UnityObject? asset,
        Func<UnityObject, string?> lookupGuid,
        Func<UnityObject, string> assetName,
        string source)
    {
        if (asset == null) return null;
        var guid = lookupGuid(asset);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, assetName(asset));
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        try
        {
            return asset == null;
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("Faction lookup failed for field 'asset' because the Unity object was destroyed.", exception);
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
            throw new InvalidOperationException("Faction lookup failed for field 'name' because the Unity object was destroyed.", exception);
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
