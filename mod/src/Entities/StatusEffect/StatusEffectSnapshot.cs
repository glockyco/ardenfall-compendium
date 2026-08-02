using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatusEffect;

public sealed record StatusEffectSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("statusEffectName")] string? StatusEffectName,
    [property: JsonProperty("tooltipSource")] string? TooltipSource,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("isHostile")] bool IsHostile);

public sealed class StatusEffectSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public StatusEffectSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class StatusEffectSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "status-effect";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<StatusEffectSnapshotRow> Rows { get; init; } = new();
}
