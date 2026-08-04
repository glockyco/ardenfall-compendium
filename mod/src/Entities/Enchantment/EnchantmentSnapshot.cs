using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Enchantment;

public sealed record EnchantmentEffectSnapshot(
    [property: JsonProperty("ordinal")] int Ordinal,
    [property: JsonProperty("kind")] string Kind,
    [property: JsonProperty("statusEffectRef")] SnapshotRef? StatusEffectRef);

public sealed record EnchantmentSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("enchantmentName")] string? EnchantmentName,
    [property: JsonProperty("moneyValue")] float MoneyValue,
    [property: JsonProperty("hideEffectTooltips")] bool HideEffectTooltips,
    [property: JsonProperty("appliesToItemRefs")] IReadOnlyList<SnapshotRef> AppliesToItemRefs,
    [property: JsonProperty("effects")] IReadOnlyList<EnchantmentEffectSnapshot> Effects);

public sealed class EnchantmentSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public EnchantmentSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class EnchantmentSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "enchantment";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<EnchantmentSnapshotRow> Rows { get; init; } = new();
}
