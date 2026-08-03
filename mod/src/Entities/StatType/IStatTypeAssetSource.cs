using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.StatType;

public sealed record StatTypeAsset(
    string? Guid,
    string AssetName,
    bool IsAttribute,
    string? StatName,
    SnapshotRef? IconRef,
    AssetColorSnapshot IconColor,
    string? StatDescription,
    string? LongStatDescription,
    IReadOnlyList<string>? Affects,
    IReadOnlyList<string>? SkillAffects);

public interface IStatTypeAssetSource
{
    IEnumerable<StatTypeAsset> EnumerateStatTypes();
}
