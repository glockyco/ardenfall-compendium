using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Spell;

// This is an extraction-only shape. It never reaches the snapshot JSON.
public sealed record SpellEffectAsset(
    string Kind,
    StatusEffectData? StatusEffect = null,
    float? SampleLevel = null,
    float? SampleLifetimeSeconds = null,
    bool AppliesToSelf = false,
    float? Damage = null,
    string? DamageType = null,
    string? GameClassName = null,
    bool IsSkipped = false);

public sealed record SpellAsset(
    string? Guid,
    string AssetName,
    string? SpellName,
    SnapshotRef? StatTypeRef,
    float ManaCost,
    bool IsIllegal,
    SnapshotRef? IconRef,
    string? TooltipSource = null,
    IReadOnlyList<SpellEffectAsset>? SpellEffects = null);

public interface ISpellAssetSource
{
    IEnumerable<SpellAsset> EnumerateSpells();
}
