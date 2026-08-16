using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.CharacterRace;

public sealed class LoadedCharacterRaceAssetSource : ICharacterRaceAssetSource
{
    private readonly Func<IEnumerable<Ardenfall.CharacterRace>> _loadedCharacterRaces;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;

    public LoadedCharacterRaceAssetSource()
        : this(
            loadedCharacterRaces: () => Resources.FindObjectsOfTypeAll<Ardenfall.CharacterRace>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName)
    {
    }

    public LoadedCharacterRaceAssetSource(
        Func<IEnumerable<Ardenfall.CharacterRace>> loadedCharacterRaces,
        Func<UnityObject?, bool>? isUnityNull = null,
        Func<UnityObject, string>? assetName = null)
    {
        _loadedCharacterRaces = loadedCharacterRaces ?? throw new ArgumentNullException(nameof(loadedCharacterRaces));
        _isUnityNull = isUnityNull ?? IsUnityNull;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<CharacterRaceAsset> EnumerateCharacterRaces()
    {
        var seen = new HashSet<Ardenfall.CharacterRace>(
            UnityObjectReferenceComparer<Ardenfall.CharacterRace>.Instance);
        var assets = new List<Ardenfall.CharacterRace>();
        foreach (var asset in _loadedCharacterRaces())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }

            if (seen.Add(asset)) assets.Add(asset);
        }

        foreach (var asset in assets.OrderBy(asset => _assetName(asset), StringComparer.Ordinal))
        {
            var raceNameResolution = ParameterChain.Resolve(asset, asset.raceName);
            var raceName = raceNameResolution.Value;
            var raceNameOwnership = raceNameResolution.Ownership;
            var nameSets = ParameterChain.Resolve(asset, asset.nameSets).Value;
            var parentRef = ResolveParentRef(asset.parent);
            var nameSetAssetNames = nameSets == null
                ? null
                : nameSets.Select(nameSet => nameSet == null ? null : _assetName(nameSet)).ToList();
            yield return new CharacterRaceAsset(
                AssetName: _assetName(asset),
                RaceName: NullIfEmpty(raceName),
                NameSetAssetNames: nameSetAssetNames,
                ParentRef: parentRef,
                RaceNameProvenance: raceNameOwnership.IsSet
                    ? "own"
                    : raceNameOwnership.Inherited
                        ? "inherited"
                        : "absent",
                RaceNameOwner: raceNameOwnership.Inherited && raceNameOwnership.Owner != null
                    ? _assetName(raceNameOwnership.Owner)
                    : null);
        }
    }

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException("CharacterRace lookup failed for field 'name'.", exception);
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
            throw new InvalidOperationException("CharacterRace lookup failed for field 'asset'.", exception);
        }
    }

    private static SnapshotRef ResolveParentRef(Ardenfall.ParameterizedObject? parent)
    {
        if (parent == null) return SnapshotRef.Missing("noParent", "ParameterizedObject.parent");
        return string.IsNullOrWhiteSpace(parent.name)
            ? SnapshotRef.Missing("parentNameMissing", "ParameterizedObject.parent")
            : SnapshotRef.NamedAsset("character-race", parent.name);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
