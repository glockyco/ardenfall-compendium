using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.MasterTooltip;

public sealed class MasterTooltipVocabularySnapshot
{
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 2;
    [JsonProperty("tooltipCodes")] public Dictionary<string, string> TooltipCodes { get; init; } = new();
    [JsonProperty("tooltipColors")] public Dictionary<string, MasterTooltipColorTokenSnapshot> TooltipColors { get; init; } = new();
    [JsonProperty("tooltipTargetColor")] public AssetColorSnapshot TooltipTargetColor { get; init; } = new();
    [JsonProperty("tooltipDurationColor")] public AssetColorSnapshot TooltipDurationColor { get; init; } = new();
    [JsonProperty("positiveColor")] public AssetColorSnapshot PositiveColor { get; init; } = new();
    [JsonProperty("negativeColor")] public AssetColorSnapshot NegativeColor { get; init; } = new();
    [JsonProperty("spellSubEffectColor")] public AssetColorSnapshot SpellSubEffectColor { get; init; } = new();
    [JsonProperty("enchantmentItemColor")] public AssetColorSnapshot EnchantmentItemColor { get; init; } = new();
    [JsonProperty("primarySpellTooltip")] public string PrimarySpellTooltip { get; init; } = "";
    [JsonProperty("secondarySpellTooltip")] public string SecondarySpellTooltip { get; init; } = "";
    [JsonProperty("unmetSkillMessage")] public string UnmetSkillMessage { get; init; } = "";
    [JsonProperty("brokenDurabilityMessage")] public string BrokenDurabilityMessage { get; init; } = "";
    [JsonProperty("ruinedDurabilityMessage")] public string RuinedDurabilityMessage { get; init; } = "";
    [JsonProperty("statBookMessage")] public string StatBookMessage { get; init; } = "";
    [JsonProperty("termSetColors")] public List<MasterTooltipTermSetColorSnapshot> TermSetColors { get; init; } = new();
    [JsonProperty("globalTermSets")] public List<MasterTooltipTermSetSnapshot> GlobalTermSets { get; init; } = new();
    [JsonProperty("termColorMatch")] public string TermColorMatch { get; init; } = "";
    [JsonProperty("potionRecipeDescription")] public string PotionRecipeDescription { get; init; } = "";
}

public sealed class MasterTooltipColorTokenSnapshot
{
    [JsonProperty("color")] public string Color { get; init; } = "";
    [JsonProperty("text")] public string Text { get; init; } = "";
}

public sealed class MasterTooltipTermSetColorSnapshot
{
    [JsonProperty("categoryId")] public string CategoryId { get; init; } = "";
    [JsonProperty("replaceWithStart")] public string ReplaceWithStart { get; init; } = "";
    [JsonProperty("replaceWithEnd")] public string ReplaceWithEnd { get; init; } = "";
    [JsonProperty("enableJournalOverride")] public bool EnableJournalOverride { get; init; }
    [JsonProperty("replaceWithStartJournal")] public string ReplaceWithStartJournal { get; init; } = "";
    [JsonProperty("replaceWithEndJournal")] public string ReplaceWithEndJournal { get; init; } = "";
    [JsonProperty("start")] public string Start { get; init; } = "";
    [JsonProperty("end")] public string End { get; init; } = "";
}

public sealed class MasterTooltipTermSetSnapshot
{
    [JsonProperty("setId")] public string SetId { get; init; } = "";
    [JsonProperty("categoryId")] public string CategoryId { get; init; } = "";
    [JsonProperty("tooltipFormat")] public string TooltipFormat { get; init; } = "";
    [JsonProperty("terms")] public List<MasterTooltipTermSnapshot> Terms { get; init; } = new();
}

public sealed class MasterTooltipTermSnapshot
{
    [JsonProperty("value")] public string Value { get; init; } = "";
    [JsonProperty("definition")] public string Definition { get; init; } = "";
}
