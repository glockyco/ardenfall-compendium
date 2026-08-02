using System;
using System.Collections.Generic;
using System.Linq;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Spell;

public sealed record SpellAsset(
    string? Guid,
    string AssetName,
    string? SpellName,
    UnityObject? StatType,
    float ManaCost,
    bool IsIllegal,
    UnityObject? Icon,
    string? TooltipSource = null);

public interface ISpellAssetSource
{
    IEnumerable<SpellAsset> EnumerateSpells();
}

public sealed class LoadedSpellAssetSource : ISpellAssetSource
{
    private readonly Func<IEnumerable<Ardenfall.SpellData>> _loadedSpells;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;
    private readonly Func<UnityObject, bool> _isAuthoredAsset;

    public LoadedSpellAssetSource()
        : this(
            loadedSpells: () => UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.SpellData>(),
            isUnityNull: IsUnityNull,
            assetName: SafeName,
            isAuthoredAsset: IsAuthoredAsset)
    {
    }

    public LoadedSpellAssetSource(
        Func<IEnumerable<Ardenfall.SpellData>> loadedSpells,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string>? assetName = null,
        Func<UnityObject, bool>? isAuthoredAsset = null)
    {
        _loadedSpells = loadedSpells;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
        _isAuthoredAsset = isAuthoredAsset ?? IsAuthoredAsset;
    }

    public IEnumerable<SpellAsset> EnumerateSpells()
    {
        var seen = new HashSet<Ardenfall.SpellData>(
            UnityObjectReferenceComparer<Ardenfall.SpellData>.Instance);
        var assets = new List<Ardenfall.SpellData>();
        foreach (var asset in _loadedSpells())
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

    private SpellAsset ToAsset(Ardenfall.SpellData asset) => new(
        Guid: null,
        AssetName: _assetName(asset),
        SpellName: asset.spellName,
        StatType: asset.statType,
        ManaCost: asset.manaCost,
        // The game's field is misspelled as isIlligal. Keep that source spelling here.
        IsIllegal: asset.isIlligal,
        Icon: asset.icon,
        TooltipSource: NullIfEmpty(asset.tooltip?.GetTooltip(1f, 1f, asset)));

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

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
