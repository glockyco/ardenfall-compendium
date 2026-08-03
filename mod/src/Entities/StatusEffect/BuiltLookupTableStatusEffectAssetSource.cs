using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed class BuiltLookupTableStatusEffectAssetSource : IStatusEffectAssetSource, IIconAssetPlanSink
{
    private IconAssetPlan? _assetPlan;
    public void AttachAssetPlan(IconAssetPlan? assetPlan) => _assetPlan = assetPlan;

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
            var icon = asset.statusEffectIcon;
            if (_assetPlan != null && !string.IsNullOrWhiteSpace(guid) && icon is Sprite sprite)
            {
                _assetPlan.Slots.Add(new IconAssetSlot("status-effect", guid, "iconRef", sprite, "status-effect", "StatusEffectData.statusEffectIcon"));
            }
            yield return new StatusEffectAsset(
                Guid: guid,
                AssetName: asset.name ?? "",
                StatusEffectName: asset.statusEffectName,
                TooltipSource: NullIfEmpty(asset.tooltip?.GetTooltip(1f, 1f, false, asset)),
                IconRef: icon == null
                    ? null
                    : SnapshotRef.Missing("engineResource", "StatusEffectData.statusEffectIcon"),
                IsHostile: asset.isHostile);
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
