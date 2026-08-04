using System;
using System.Collections.Generic;
using System.Reflection;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Enchantment;

public sealed class LoadedEnchantmentAssetSource : IEnchantmentAssetSource
{
    private readonly Func<IEnumerable<EnchantmentData>> _lookupEnchantments;
    private readonly Func<UnityObject?, bool> _isUnityNull;
    private readonly Func<UnityObject, string?> _lookupGuid;
    private readonly Func<UnityObject, string> _assetName;

    public LoadedEnchantmentAssetSource()
        : this(
            lookupEnchantments: () => BuiltLookupTable.GetAssetsOfType<EnchantmentData>(),
            isUnityNull: IsUnityNull,
            lookupGuid: LookupGuid,
            assetName: SafeName)
    {
    }

    public LoadedEnchantmentAssetSource(
        Func<IEnumerable<EnchantmentData>> lookupEnchantments,
        Func<UnityObject?, bool> isUnityNull,
        Func<UnityObject, string?>? lookupGuid = null,
        Func<UnityObject, string>? assetName = null)
    {
        _lookupEnchantments = lookupEnchantments;
        _isUnityNull = isUnityNull;
        _lookupGuid = lookupGuid ?? LookupGuid;
        _assetName = assetName ?? SafeName;
    }

    public IEnumerable<EnchantmentAsset> EnumerateEnchantments()
    {
        foreach (var asset in _lookupEnchantments())
        {
            if (_isUnityNull(asset))
            {
                yield return null!;
                continue;
            }

            var itemRefs = new List<SnapshotRef>();
            foreach (var item in asset.baseItemDataFilterWhitelist ?? new List<ItemData>())
            {
                var itemRef = ResolveAsset(item, _lookupGuid, _assetName, "EnchantmentData.baseItemDataFilterWhitelist");
                if (itemRef != null) itemRefs.Add(itemRef);
            }

            var effects = new List<EnchantmentEffectAsset>();
            foreach (var effect in asset.effects ?? new List<EnchantmentEffect>())
            {
                if (effect == null) continue;
                var kind = effect.GetType().Name;
                SnapshotRef? statusEffectRef = null;
                if (effect is StatusEffectEnchantmentEffect)
                {
                    var wrapper = ReadField<LeveledLeveledStatusEffect>(effect, "statusEffect");
                    statusEffectRef = ResolveAsset(
                        wrapper?.StatusEffect,
                        _lookupGuid,
                        _assetName,
                        "StatusEffectEnchantmentEffect.statusEffect");
                }
                effects.Add(new EnchantmentEffectAsset(kind, statusEffectRef));
            }

            yield return new EnchantmentAsset(
                Guid: _lookupGuid(asset),
                AssetName: _assetName(asset),
                EnchantmentName: asset.enchantmentName,
                MoneyValue: asset.moneyValue,
                HideEffectTooltips: asset.hideEffectTooltips,
                AppliesToItemRefs: itemRefs,
                Effects: effects,
                BlacklistEntryCount: asset.baseItemDataFilterBlacklist?.Count ?? 0);
        }
    }

    private static T ReadField<T>(object value, string field)
    {
        var info = value.GetType().GetField(
            field,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        if (info == null)
        {
            throw new MissingFieldException(value.GetType().FullName, field);
        }
        return (T)info.GetValue(value)!;
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

    private static string? LookupGuid(UnityObject asset) => BuiltLookupTable.Instance?.GetGuid(asset);

    private static string SafeName(UnityObject asset)
    {
        try
        {
            return asset.name ?? "";
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("EnchantmentData lookup failed for field 'name' because the Unity object was destroyed.", exception);
        }
    }

    private static bool IsUnityNull(UnityObject? asset)
    {
        if (ReferenceEquals(asset, null)) return true;
        try
        {
            return asset == null;
        }
        catch (MissingReferenceException exception)
        {
            throw new InvalidOperationException("EnchantmentData lookup failed for field 'asset' because the Unity object was destroyed.", exception);
        }
    }
}
