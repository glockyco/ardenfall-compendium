using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed class BuiltLookupTableStatusEffectAssetSource : IStatusEffectAssetSource
{
    public IEnumerable<StatusEffectAsset> EnumerateStatusEffects()
    {
        var lookup = BuiltLookupTable.Instance;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<Ardenfall.StatusEffectData>())
        {
            if (asset == null)
            {
                yield return null!;
                continue;
            }
            var guid = lookup?.GetGuid(asset);
            yield return new StatusEffectAsset(
                Guid: guid,
                AssetName: asset.name ?? "",
                StatusEffectName: asset.statusEffectName,
                TooltipSource: NullIfEmpty(asset.tooltip?.GetTooltip(1f, 1f, false, asset)),
                IconRef: asset.statusEffectIcon == null
                    ? null
                    : SnapshotRef.Missing("engineResource", "StatusEffectData.statusEffectIcon"),
                IsHostile: asset.isHostile);
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
