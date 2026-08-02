using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Item;

public sealed class ItemPresentationSnapshot
{
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("renderContext")] public string RenderContext { get; init; } = "item-presentation-v1";
    [JsonProperty("displayName")] public string DisplayName { get; init; } = "";
    [JsonProperty("displayNameSourceMethod")] public string DisplayNameSourceMethod { get; init; } = "unknown";
    [JsonProperty("itemType")] public string? ItemType { get; init; }
    [JsonProperty("itemTypeSourceMethod")] public string? ItemTypeSourceMethod { get; init; }
    [JsonProperty("descriptionSource")] public string DescriptionSource { get; init; } = "";
    [JsonProperty("effectsSource")] public string EffectsSource { get; init; } = "";
    [JsonProperty("effects")] public List<ItemPresentationEffectSnapshot> Effects { get; init; } = new();
    [JsonProperty("statRows")] public List<ItemPresentationStatRowSnapshot> StatRows { get; init; } = new();
    [JsonProperty("requirements")] public List<ItemPresentationRequirementSnapshot> Requirements { get; init; } = new();
    [JsonProperty("durability")] public ItemPresentationDurabilitySnapshot? Durability { get; init; }
    [JsonProperty("stateFacts")] public List<ItemPresentationStateFactSnapshot> StateFacts { get; init; } = new();
    [JsonProperty("value")] public int? Value { get; init; }
    [JsonProperty("weight")] public float? Weight { get; init; }
    [JsonProperty("diagnostics")] public List<ItemPresentationDiagnosticSnapshot> Diagnostics { get; init; } = new();
}

public sealed class ItemPresentationStatRowSnapshot
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("value")] public float? Value { get; init; }
    [JsonProperty("valueText")] public string ValueText { get; init; } = "";
    [JsonProperty("suffix")] public string? Suffix { get; init; }
    [JsonProperty("size")] public string Size { get; init; } = "normal";
    [JsonProperty("indent")] public int Indent { get; init; }
    [JsonProperty("comparison")] public string? Comparison { get; init; }
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationRequirementSnapshot
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("valueText")] public string ValueText { get; init; } = "";
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationEffectSnapshot
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("targetType")] public string? TargetType { get; init; }
    [JsonProperty("targetId")] public string? TargetId { get; init; }
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationDurabilitySnapshot
{
    [JsonProperty("kind")] public string Kind { get; init; } = "max-durability";
    [JsonProperty("max")] public float Max { get; init; }
    [JsonProperty("source")] public string Source { get; init; } = "";
}

public sealed class ItemPresentationStateFactSnapshot
{
    [JsonProperty("kind")] public string Kind { get; init; } = "";
    [JsonProperty("label")] public string Label { get; init; } = "";
    [JsonProperty("description")] public string Description { get; init; } = "";
}

public sealed class ItemPresentationDiagnosticSnapshot
{
    [JsonProperty("severity")] public string Severity { get; init; } = "diagnostic";
    [JsonProperty("code")] public string Code { get; init; } = "";
    [JsonProperty("field")] public string Field { get; init; } = "presentation";
    [JsonProperty("message")] public string Message { get; init; } = "";
}
