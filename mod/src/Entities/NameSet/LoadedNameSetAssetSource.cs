using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.NameSet;

public sealed class LoadedNameSetAssetSource : INameSetAssetSource
{
    private readonly Func<IEnumerable<Ardenfall.NameSet>> _loadedNameSets;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;

    public LoadedNameSetAssetSource()
        : this(
            loadedNameSets: () => Resources.FindObjectsOfTypeAll<Ardenfall.NameSet>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName)
    {
    }

    public LoadedNameSetAssetSource(
        Func<IEnumerable<Ardenfall.NameSet>> loadedNameSets,
        Func<UnityObject?, bool>? isUnityNull = null,
        Func<UnityObject, string>? assetName = null)
    {
        _loadedNameSets = loadedNameSets ?? throw new ArgumentNullException(nameof(loadedNameSets));
        _isUnityNull = isUnityNull ?? IsUnityNull;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<NameSetAsset> EnumerateNameSets()
    {
        var seen = new HashSet<Ardenfall.NameSet>(UnityObjectReferenceComparer<Ardenfall.NameSet>.Instance);
        var assets = new List<Ardenfall.NameSet>();
        foreach (var asset in _loadedNameSets())
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
            var seeds = asset.names == null
                ? null
                : asset.names
                    .Select(weightedName => new NameSetSeedAsset(
                        Name: weightedName?.name,
                        Weight: weightedName?.weight ?? 0))
                    .ToList();
            yield return new NameSetAsset(
                AssetName: _assetName(asset),
                Seeds: seeds,
                GenerationOrder: asset.generationOrder);
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
            throw new InvalidOperationException("NameSet lookup failed for field 'name'.", exception);
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
            throw new InvalidOperationException("NameSet lookup failed for field 'asset'.", exception);
        }
    }
}
