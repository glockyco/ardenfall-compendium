using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.PotionRecipe;

public sealed record PotionRecipeIngredientSnapshot(
    [property: JsonProperty("tagRef")] SnapshotRef? TagRef,
    [property: JsonProperty("count")] int Count);

public sealed record PotionRecipeProductSnapshot(
    [property: JsonProperty("ref")] SnapshotRef? Ref,
    [property: JsonProperty("form")] string Form);

public sealed record PotionRecipeSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("statusEffectRef")] SnapshotRef StatusEffectRef,
    [property: JsonProperty("lockedByDefault")] bool LockedByDefault,
    [property: JsonProperty("enableSkillRequirement")] bool EnableSkillRequirement,
    [property: JsonProperty("skillRequirement")] int SkillRequirement,
    [property: JsonProperty("levelModifier")] float LevelModifier,
    [property: JsonProperty("successModifier")] float SuccessModifier,
    [property: JsonProperty("ingredients")] IReadOnlyList<PotionRecipeIngredientSnapshot> Ingredients,
    [property: JsonProperty("producedRefs")] IReadOnlyList<PotionRecipeProductSnapshot> ProducedRefs);

public sealed class PotionRecipeSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public PotionRecipeSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class PotionRecipeSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "potion-recipe";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<PotionRecipeSnapshotRow> Rows { get; init; } = new();
}
