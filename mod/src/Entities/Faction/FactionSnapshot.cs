using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Faction;

public sealed record FactionRelationshipSnapshot(
    [property: JsonProperty("faction")] SnapshotRef? Faction,
    [property: JsonProperty("relationship")] int Relationship,
    [property: JsonProperty("isEnemy")] bool IsEnemy);

public sealed record FactionSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("name")] string? Name,
    [property: JsonProperty("factionId")] string? FactionId,
    [property: JsonProperty("description")] string? Description,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("alliable")] bool Alliable,
    [property: JsonProperty("enableReputation")] bool EnableReputation,
    [property: JsonProperty("alwaysShowInUI")] bool AlwaysShowInUI,
    [property: JsonProperty("canBeDisguised")] bool CanBeDisguised,
    [property: JsonProperty("enableBounty")] bool EnableBounty,
    [property: JsonProperty("interFactionRelationships")] List<FactionRelationshipSnapshot> InterFactionRelationships);

public sealed class FactionSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public FactionSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class FactionSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "faction";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<FactionSnapshotRow> Rows { get; init; } = new();
}
