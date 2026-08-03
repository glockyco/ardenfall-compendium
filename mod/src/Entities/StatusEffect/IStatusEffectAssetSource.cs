using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record StatusEffectAsset(
    string? Guid,
    string AssetName,
    string? StatusEffectName,
    string? TooltipSource,
    SnapshotRef? IconRef,
    bool IsHostile);

public interface IStatusEffectAssetSource
{
    IEnumerable<StatusEffectAsset> EnumerateStatusEffects();
}
