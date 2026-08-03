using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Spell;

public sealed record SpellAsset(
    string? Guid,
    string AssetName,
    string? SpellName,
    SnapshotRef? StatTypeRef,
    float ManaCost,
    bool IsIllegal,
    SnapshotRef? IconRef,
    string? TooltipSource = null);

public interface ISpellAssetSource
{
    IEnumerable<SpellAsset> EnumerateSpells();
}
