using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Enchantment;

public sealed record EnchantmentEffectAsset(
    string Kind,
    SnapshotRef? StatusEffectRef = null);

public sealed record EnchantmentAsset(
    string? Guid,
    string AssetName,
    string? EnchantmentName,
    float MoneyValue,
    bool HideEffectTooltips,
    IReadOnlyList<SnapshotRef>? AppliesToItemRefs = null,
    IReadOnlyList<EnchantmentEffectAsset>? Effects = null,
    int BlacklistEntryCount = 0);

public interface IEnchantmentAssetSource
{
    IEnumerable<EnchantmentAsset> EnumerateEnchantments();
}
