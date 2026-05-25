using System;
using System.Collections.Generic;
using System.Text;
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
    private readonly Func<ArdenfallMasterData?> _masterData;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string> _assetName;

    public BuiltLookupTableStatTypeAssetSource()
        : this(
            lookupStatTypes: () => BuiltLookupTable.GetAssetsOfType<Ardenfall.StatType>(),
            masterData: () => ArdenfallMasterData.Instance,
            isUnityNull: IsUnityNull,
            assetName: SafeName)
    {
    }

    public BuiltLookupTableStatTypeAssetSource(
        Func<IEnumerable<Ardenfall.StatType>> lookupStatTypes,
        Func<ArdenfallMasterData?> masterData,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string>? assetName = null)
    {
        _lookupStatTypes = lookupStatTypes;
        _masterData = masterData;
        _isUnityNull = isUnityNull;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<StatTypeAsset> EnumerateStatTypes()
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var asset in _lookupStatTypes())
        {
            if (_isUnityNull(asset)) continue;
            var snapshot = ToAsset(asset);
            if (!string.IsNullOrWhiteSpace(snapshot.Guid) && !seen.Add(snapshot.Guid)) continue;
            yield return snapshot;
        }

        var master = _masterData();
        if (_isUnityNull(master)) yield break;

        foreach (var asset in EnumerateMasterStats(master!))
        {
            if (_isUnityNull(asset)) continue;
            var snapshot = ToAsset(asset);
            if (!string.IsNullOrWhiteSpace(snapshot.Guid) && !seen.Add(snapshot.Guid)) continue;
            yield return snapshot;
        }
    }

    private static IEnumerable<Ardenfall.StatType> EnumerateMasterStats(ArdenfallMasterData master)
    {
        if (master.allAttributes != null)
        {
            foreach (var stat in master.allAttributes) yield return stat;
        }

        if (master.allSkills != null)
        {
            foreach (var stat in master.allSkills) yield return stat;
        }
    }

    private StatTypeAsset ToAsset(Ardenfall.StatType asset) => new(
        Guid: StableId(asset),
        AssetName: _assetName(asset),
        IsAttribute: asset.isAttribute,
        StatName: asset.statName,
        Icon: asset.icon,
        IconColor: AssetColorSnapshot.FromColor(asset.iconColor),
        StatDescription: asset.statDescription,
        LongStatDescription: asset.longStatDescription,
        Affects: asset.affects,
        SkillAffects: asset.skillAffects);

    private string? StableId(Ardenfall.StatType asset)
    {
        var guid = LookupGuid(asset);
        if (!string.IsNullOrWhiteSpace(guid)) return guid;
        if (!string.IsNullOrWhiteSpace(asset.id)) return asset.id;
        if (!string.IsNullOrWhiteSpace(asset.statName)) return NormalizeId(asset.statName);
        var name = _assetName(asset);
        return string.IsNullOrWhiteSpace(name) ? null : NormalizeId(name);
    }

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

    private static string NormalizeId(string value)
    {
        var builder = new StringBuilder(value.Length);
        var needsDash = false;
        foreach (var ch in value)
        {
            if (char.IsLetterOrDigit(ch))
            {
                if (needsDash && builder.Length > 0) builder.Append('-');
                builder.Append(char.ToLowerInvariant(ch));
                needsDash = false;
            }
            else
            {
                needsDash = true;
            }
        }

        return builder.Length == 0 ? "stat-type" : builder.ToString();
    }
}
