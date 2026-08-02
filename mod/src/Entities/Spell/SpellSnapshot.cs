using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Spell;

public sealed record SpellSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("spellName")] string? SpellName,
    [property: JsonProperty("statTypeRef")] SnapshotRef? StatTypeRef,
    [property: JsonProperty("manaCost")] float ManaCost,
    [property: JsonProperty("isIllegal")] bool IsIllegal,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("tooltipSource")] string? TooltipSource);

public sealed class SpellSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public SpellSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class SpellSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "spell";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<SpellSnapshotRow> Rows { get; init; } = new();
}
