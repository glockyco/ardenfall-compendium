using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Spell;

/// Every effect names its kind, so the discriminator belongs on the base record rather than being
/// repeated on each subtype. The kind is our own vocabulary and never the game's class name.
public abstract record SpellEffectSnapshot(
    [property: JsonProperty("kind")] string Kind);

public sealed record StatusSpellEffectSnapshot(
    string Kind,
    [property: JsonProperty("statusEffectRef")] SnapshotRef? StatusEffectRef,
    [property: JsonProperty("sampleLevel")] float SampleLevel,
    [property: JsonProperty("sampleLifetimeSeconds")] float SampleLifetimeSeconds,
    [property: JsonProperty("appliesToSelf")] bool AppliesToSelf) : SpellEffectSnapshot(Kind);

public sealed record DirectSpellEffectSnapshot(string Kind) : SpellEffectSnapshot(Kind);

public sealed record DamageSpellEffectSnapshot(
    string Kind,
    [property: JsonProperty("damage")] float Damage,
    [property: JsonProperty("damageType")] string DamageType) : SpellEffectSnapshot(Kind);

public sealed record SpellSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("spellName")] string? SpellName,
    [property: JsonProperty("statTypeRef")] SnapshotRef? StatTypeRef,
    [property: JsonProperty("manaCost")] float? ManaCost,
    [property: JsonProperty("isIllegal")] bool? IsIllegal,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("tooltipSource")] string? TooltipSource,
    [property: JsonProperty("spellEffects")] IReadOnlyList<SpellEffectSnapshot> SpellEffects);

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
