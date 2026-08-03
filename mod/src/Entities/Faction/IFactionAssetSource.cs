using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Faction;

public sealed record FactionRelationshipRecord(
    SnapshotRef? Faction,
    int Relationship,
    bool IsEnemy);

public sealed record FactionAssetRecord(
    string? Guid,
    string AssetName,
    string? Title,
    string? FactionId,
    string? Description,
    SnapshotRef? IconRef,
    bool Alliable,
    bool EnableReputation,
    bool AlwaysShowInUI,
    bool CanBeDisguised,
    bool EnableBounty,
    IReadOnlyList<FactionRelationshipRecord?>? InterFactionRelationships);

public interface IFactionAssetSource
{
    IEnumerable<FactionAssetRecord> EnumerateFactions();
}
