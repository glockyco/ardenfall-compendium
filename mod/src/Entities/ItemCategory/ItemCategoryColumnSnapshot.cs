using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.ItemCategory;

public sealed record ItemCategoryColumnSnapshot(
    [property: JsonProperty("label")] string? Label,
    [property: JsonProperty("iconRef")] SnapshotRef? IconRef,
    [property: JsonProperty("preferedWidth")] float PreferedWidth,
    [property: JsonProperty("flexibleWidth")] float FlexibleWidth,
    [property: JsonProperty("itemName")] bool IsItemName,
    [property: JsonProperty("isItemIconAndCategory")] bool IsItemIconAndCategory,
    [property: JsonProperty("itemValue")] bool IsItemValue,
    [property: JsonProperty("isAffectedBySkillRequirement")] bool IsAffectedBySkillRequirement,
    [property: JsonProperty("isAffectedByBrokenDurability")] bool IsAffectedByBrokenDurability,
    [property: JsonProperty("affectingRedColor")] bool AffectingRedColor,
    [property: JsonProperty("affectingIconsAfter")] bool AffectingIconsAfter,
    [property: JsonProperty("hideIfNegativeOne")] bool HideIfNegativeOne,
    [property: JsonProperty("alignment")] string Alignment,
    [property: JsonProperty("itemDataField")] string? ItemDataField,
    [property: JsonProperty("itemFunctionField")] string? ItemFunctionField);
