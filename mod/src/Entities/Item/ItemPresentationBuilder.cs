using System;
using System.Collections.Generic;
using System.Globalization;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Item;

public static class ItemPresentationBuilder
{
    private static readonly (string Field, string Label, string Source, string Size)[] StatFields =
    {
        ("damage", "Base damage", "MeleeItem.GetItemStatInfos()", "large"),
        ("armorRating", "Damage Threshold", "ArmorItem.GetItemStatInfos()", "large"),
        ("quickslotCooldownTime", "Cooldown", "ConsumableItem.quickslotCooldownTime.Get()", "normal"),
        ("manaCostMultiplier", "Mana cost multiplier", "SlateSpellItem.manaCostMultiplier.Get()", "normal"),
    };

    public static ItemPresentationSnapshot FromExtractedFields(
        string rowId,
        string variantId,
        IReadOnlyDictionary<string, object?> fields,
        IReadOnlyDictionary<string, Provenance> provenance)
    {
        var displayName = StringField(fields, "name") ?? rowId;
        var effects = BuildEffects(fields);
        return new ItemPresentationSnapshot
        {
            DisplayName = displayName,
            DisplayNameSourceMethod = provenance.TryGetValue("name", out var nameProvenance) && nameProvenance.Source.Length > 0
                ? nameProvenance.Source
                : "fields.name",
            ItemType = StringField(fields, "itemTypeTooltip") ?? TitleCaseVariant(variantId),
            ItemTypeSourceMethod = fields.ContainsKey("itemTypeTooltip") ? "itemTypeTooltip" : $"variant:{variantId}",
            DescriptionSource = StringField(fields, "description") ?? "",
            EffectsSource = BuildEffectsSource(effects, fields),
            Effects = effects,
            StatRows = BuildStatRows(fields),
            Requirements = BuildRequirements(fields),
            Durability = BuildDurability(fields),
            StateFacts = BuildStateFacts(fields),
            Omissions = BuildOmissions(variantId),
            Value = IntField(fields, "value"),
            Weight = FloatField(fields, "weight"),
            Diagnostics = BuildDiagnostics(effects),
        };
    }

    private static List<ItemPresentationStatRowSnapshot> BuildStatRows(IReadOnlyDictionary<string, object?> fields)
    {
        var rows = new List<ItemPresentationStatRowSnapshot>();
        foreach (var stat in StatFields)
        {
            var value = FloatField(fields, stat.Field);
            if (value == null) continue;
            rows.Add(new ItemPresentationStatRowSnapshot
            {
                Id = stat.Field,
                Label = stat.Label,
                Value = value,
                ValueText = FormatNumber(value.Value),
                Size = stat.Size,
                Source = stat.Source,
            });
            if (stat.Field == "damage") AddHeavyAttackDamageRow(fields, rows);
        }
        return rows;
    }

    private static void AddHeavyAttackDamageRow(
        IReadOnlyDictionary<string, object?> fields,
        List<ItemPresentationStatRowSnapshot> rows)
    {
        var damage = FloatField(fields, "damage");
        var multiplier = FloatField(fields, "hardAttackDamMult");
        if (damage == null || multiplier == null) return;

        var value = damage.Value * multiplier.Value;
        rows.Add(new ItemPresentationStatRowSnapshot
        {
            Id = "heavyAttackDamage",
            Label = "Heavy Attack Damage",
            Value = value,
            ValueText = FormatNumber(value),
            Size = "large",
            Source = "MeleeItem.GetItemStatInfos()",
        });
    }

    private static List<ItemPresentationRequirementSnapshot> BuildRequirements(IReadOnlyDictionary<string, object?> fields)
    {
        var rows = new List<ItemPresentationRequirementSnapshot>();
        var minimumSkill = IntField(fields, "minimumSkill");
        var statType = StringField(fields, "statType");
        if (minimumSkill != null && minimumSkill.Value > 0 && !string.IsNullOrWhiteSpace(statType))
        {
            rows.Add(new ItemPresentationRequirementSnapshot
            {
                Id = "minimum-skill",
                Label = statType!,
                ValueText = minimumSkill.Value.ToString(CultureInfo.InvariantCulture),
                Source = "EquipItemData.minimumSkill/statType",
            });
        }
        return rows;
    }

    private static ItemPresentationDurabilitySnapshot? BuildDurability(IReadOnlyDictionary<string, object?> fields)
    {
        foreach (var field in new[] { "meleeDurabilityMax", "armorDurabilityMax", "durabilityMax" })
        {
            var max = FloatField(fields, field);
            if (max == null || max.Value <= 0) continue;
            return new ItemPresentationDurabilitySnapshot
            {
                Max = max.Value,
                Source = field,
            };
        }
        return null;
    }

    private static List<ItemPresentationStateFactSnapshot> BuildStateFacts(IReadOnlyDictionary<string, object?> fields)
    {
        var facts = new List<ItemPresentationStateFactSnapshot>();
        if (BoolField(fields, "stackable") == true)
        {
            facts.Add(new ItemPresentationStateFactSnapshot
            {
                Kind = "stacking",
                Label = "Stackable",
                Description = "Multiple copies can stack in inventory.",
            });
        }
        if (BoolField(fields, "isDrinkingPotion") is { } isDrinkingPotion)
        {
            facts.Add(new ItemPresentationStateFactSnapshot
            {
                Kind = "potion-use-mode",
                Label = isDrinkingPotion ? "Drink potion" : "Throwing potion",
                Description = isDrinkingPotion ? "Uses drink potion behavior." : "Uses throwing potion behavior.",
            });
        }
        return facts;
    }

    private static List<ItemPresentationOmissionSnapshot> BuildOmissions(string variantId)
    {
        if (!RequiresEquippedComparison(variantId)) return new List<ItemPresentationOmissionSnapshot>();
        return new List<ItemPresentationOmissionSnapshot>
        {
            new()
            {
                Code = "equippedComparisonOmitted",
                Severity = "diagnostic",
                Message = "Equipped comparison requires player inventory state.",
            },
        };
    }

    private static List<ItemPresentationEffectSnapshot> BuildEffects(IReadOnlyDictionary<string, object?> fields)
    {
        var effects = new List<ItemPresentationEffectSnapshot>();
        var spellName = NestedString(fields, "spellDataJson", "spellName") ?? NestedString(fields, "spellDataJson", "name");
        var spellId = NestedString(fields, "spellDataJson", "id");
        if (!string.IsNullOrWhiteSpace(spellName))
        {
            effects.Add(new ItemPresentationEffectSnapshot
            {
                Kind = "spell",
                Label = spellName!,
                TargetType = "spell",
                TargetId = spellId,
                Source = "spellDataJson",
            });
        }

        var effectName = StringField(fields, "effectName");
        if (!string.IsNullOrWhiteSpace(effectName))
        {
            effects.Add(new ItemPresentationEffectSnapshot
            {
                Kind = "status-effect",
                Label = effectName!,
                TargetType = "status-effect",
                Source = "effectName",
            });
        }

        if (fields.ContainsKey("statusEffectsJson"))
        {
            effects.Add(new ItemPresentationEffectSnapshot
            {
                Kind = "status-effect",
                Label = "Status effects",
                TargetType = "status-effect",
                Source = "statusEffectsJson",
            });
        }
        return effects;
    }

    private static string BuildEffectsSource(IReadOnlyList<ItemPresentationEffectSnapshot> effects, IReadOnlyDictionary<string, object?> fields)
    {
        if (effects.Count == 0) return "";
        var spellName = NestedString(fields, "spellDataJson", "spellName") ?? NestedString(fields, "spellDataJson", "name");
        if (!string.IsNullOrWhiteSpace(spellName))
        {
            return "Casts " + spellName;
        }
        if (!string.IsNullOrWhiteSpace(StringField(fields, "effectName")))
        {
            return "Effect: " + StringField(fields, "effectName");
        }
        return "Applies status effects";
    }

    private static List<ItemPresentationDiagnosticSnapshot> BuildDiagnostics(IEnumerable<ItemPresentationEffectSnapshot> effects)
    {
        var diagnostics = new List<ItemPresentationDiagnosticSnapshot>();
        foreach (var effect in effects)
        {
            if (effect.TargetType != null && string.IsNullOrWhiteSpace(effect.TargetId))
            {
                diagnostics.Add(new ItemPresentationDiagnosticSnapshot
                {
                    Code = "unresolvedEffectTarget",
                    Field = "presentation.effects",
                    Message = $"Effect '{effect.Label}' does not have a resolved {effect.TargetType} target.",
                });
            }
        }
        return diagnostics;
    }

    private static bool RequiresEquippedComparison(string variantId) =>
        variantId.Contains("weapon", StringComparison.Ordinal) ||
        variantId.Contains("armor", StringComparison.Ordinal) ||
        variantId.Contains("hand", StringComparison.Ordinal) ||
        variantId == "slate-spell" ||
        variantId == "throwing-item" ||
        variantId == "throwing-potion";

    private static string TitleCaseVariant(string variantId)
    {
        var spaced = variantId.Replace('-', ' ');
        return spaced.Length == 0 ? variantId : char.ToUpperInvariant(spaced[0]) + spaced[1..];
    }

    private static string FormatNumber(float value) =>
        value.ToString(value % 1 == 0 ? "0" : "0.###", CultureInfo.InvariantCulture);

    private static string? StringField(IReadOnlyDictionary<string, object?> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value?.ToString() : null;

    private static int? IntField(IReadOnlyDictionary<string, object?> fields, string key)
    {
        if (!fields.TryGetValue(key, out var value) || value == null) return null;
        return value switch
        {
            int i => i,
            long l => checked((int)l),
            float f => checked((int)f),
            double d => checked((int)d),
            _ when int.TryParse(value.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null,
        };
    }

    private static float? FloatField(IReadOnlyDictionary<string, object?> fields, string key)
    {
        if (!fields.TryGetValue(key, out var value) || value == null) return null;
        return value switch
        {
            float f => f,
            double d => (float)d,
            int i => i,
            long l => l,
            _ when float.TryParse(value.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null,
        };
    }

    private static bool? BoolField(IReadOnlyDictionary<string, object?> fields, string key)
    {
        if (!fields.TryGetValue(key, out var value) || value == null) return null;
        return value switch
        {
            bool b => b,
            int i => i != 0,
            _ when bool.TryParse(value.ToString(), out var parsed) => parsed,
            _ => null,
        };
    }

    private static string? NestedString(IReadOnlyDictionary<string, object?> fields, string key, string nestedKey)
    {
        if (!fields.TryGetValue(key, out var value) || value == null) return null;
        if (value is IReadOnlyDictionary<string, object?> dict && dict.TryGetValue(nestedKey, out var nested))
        {
            return nested?.ToString();
        }
        if (value is IReadOnlyDictionary<string, string> stringDict && stringDict.TryGetValue(nestedKey, out var nestedString))
        {
            return nestedString;
        }
        var property = value.GetType().GetProperty(nestedKey) ?? value.GetType().GetProperty(char.ToUpperInvariant(nestedKey[0]) + nestedKey[1..]);
        return property?.GetValue(value)?.ToString();
    }
}
