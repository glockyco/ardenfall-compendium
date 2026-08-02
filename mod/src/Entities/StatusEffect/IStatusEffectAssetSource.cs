using System.Collections.Generic;
using Ardenfall;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record StatusEffectAsset(
    string? Guid,
    string AssetName,
    string? StatusEffectName,
    string? TooltipSource,
    UnityObject? Icon,
    bool IsHostile);

public interface IStatusEffectAssetSource
{
    IEnumerable<StatusEffectAsset> EnumerateStatusEffects();
}

public sealed class BuiltLookupTableStatusEffectAssetSource : IStatusEffectAssetSource
{
    public IEnumerable<StatusEffectAsset> EnumerateStatusEffects()
    {
        var lookup = BuiltLookupTable.Instance;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<Ardenfall.StatusEffectData>())
        {
            if (asset == null) continue;
            // This is the non-self-targeted tooltip. A self-targeted variant reads differently.
            var tooltipSource = NullIfEmpty(asset.tooltip?.GetTooltip(1f, 1f, false, asset));
            yield return new StatusEffectAsset(
                Guid: lookup?.GetGuid(asset),
                AssetName: asset.name ?? "",
                StatusEffectName: asset.statusEffectName,
                TooltipSource: tooltipSource,
                Icon: asset.statusEffectIcon,
                IsHostile: asset.isHostile);
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
