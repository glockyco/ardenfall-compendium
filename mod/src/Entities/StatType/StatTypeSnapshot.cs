using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatType;

public sealed record StatTypeSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("isAttribute")] bool IsAttribute,
    [property: JsonProperty("statName")] string StatName,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("iconColor")] AssetColorSnapshot? IconColor,
    [property: JsonProperty("statDescription")] string? StatDescription,
    [property: JsonProperty("longStatDescription")] string? LongStatDescription,
    [property: JsonProperty("affects")] List<string> Affects,
    [property: JsonProperty("skillAffects")] List<string> SkillAffects);

public sealed class StatTypeSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "stat-type";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<StatTypeSnapshot> Rows { get; init; } = new();
}
