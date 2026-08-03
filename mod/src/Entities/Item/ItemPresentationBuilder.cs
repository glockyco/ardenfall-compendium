using System.Collections.Generic;
using System.Globalization;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item.Adapters;

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
        IReadOnlyDictionary<string, Provenance> provenance,
        IReadOnlyDictionary<string, object?>? presentationOnlyFields = null)
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
            StatRows = BuildStatRows(fields, presentationOnlyFields),
            Requirements = BuildRequirements(fields),
            Durability = BuildDurability(fields),
            StateFacts = BuildStateFacts(fields),
            Value = IntField(fields, "value"),
            Weight = FloatField(fields, "weight"),
            Diagnostics = BuildDiagnostics(effects),
        };
    }

    private static List<ItemPresentationStatRowSnapshot> BuildStatRows(
        IReadOnlyDictionary<string, object?> fields,
        IReadOnlyDictionary<string, object?>? presentationOnlyFields)
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
            if (stat.Field == "damage") AddHeavyAttackDamageRow(fields, presentationOnlyFields, rows);
        }
        return rows;
    }

    private static void AddHeavyAttackDamageRow(
        IReadOnlyDictionary<string, object?> fields,
        IReadOnlyDictionary<string, object?>? presentationOnlyFields,
        List<ItemPresentationStatRowSnapshot> rows)
    {
        var damage = FloatField(fields, "damage");
        var multiplier = presentationOnlyFields == null ? null : FloatField(presentationOnlyFields, "hardAttackDamMult");
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

    private static List<ItemPresentationEffectSnapshot> BuildEffects(IReadOnlyDictionary<string, object?> fields)
    {
        var effects = new List<ItemPresentationEffectSnapshot>();
        AddSpellEffect(fields, "spellDataJson", effects);
        AddSpellEffect(fields, "secondarySpellDataJson", effects);

        var effectName = StringField(fields, "effectName");
        AddStatusEffects(fields, "statusEffectsJson", effectName, effects);
        AddStatusEffects(fields, "areaOfEffectJson", effectName, effects);
        AddStatusEffects(fields, "bleedStatusEffectJson", effectName, effects);

        return effects;
    }

    private static void AddSpellEffect(
        IReadOnlyDictionary<string, object?> fields,
        string source,
        List<ItemPresentationEffectSnapshot> effects)
    {
        if (!fields.TryGetValue(source, out var value) || value is not LeveledSpellDataSnapshot snapshot) return;
        if (snapshot.SpellRef == null && string.IsNullOrWhiteSpace(snapshot.SpellName)) return;

        var refName = snapshot.SpellRef?.Name;
        var label = !string.IsNullOrWhiteSpace(snapshot.SpellName)
            ? snapshot.SpellName!
            : !string.IsNullOrWhiteSpace(refName) ? refName! : "";
        effects.Add(new ItemPresentationEffectSnapshot
        {
            Kind = "spell",
            Label = label,
            TargetType = "spell",
            TargetRef = snapshot.SpellRef,
            Level = snapshot.Level,
            Source = source,
        });
    }

    private static void AddStatusEffects(
        IReadOnlyDictionary<string, object?> fields,
        string field,
        string? effectName,
        List<ItemPresentationEffectSnapshot> effects)
    {
        if (!fields.TryGetValue(field, out var value) || value == null) return;

        if (value is LeveledStatusEffectSnapshot single)
        {
            AddStatusEffect(single, field, effectName, effects);
            return;
        }

        if (value is IEnumerable<LeveledStatusEffectSnapshot> snapshots)
        {
            foreach (var snapshot in snapshots)
            {
                if (snapshot != null) AddStatusEffect(snapshot, field, effectName, effects);
            }
        }
    }

    private static void AddStatusEffect(
        LeveledStatusEffectSnapshot snapshot,
        string source,
        string? effectName,
        List<ItemPresentationEffectSnapshot> effects)
    {
        // A LeveledStatusEffect is a Parameter with a default instance, so an item that never
        // configured one still carries an empty snapshot. Level and lifetime are both zero in
        // that state and it means the item applies nothing, not that a reference went missing.
        // Emitting it produced 200 facts that named no effect and diagnosed themselves as
        // unresolved. A null reference carrying a level would be a real contradiction, so that
        // case is reported rather than skipped.
        if (snapshot.StatusEffectRef == null)
        {
            if (snapshot.Level == 0f && snapshot.Lifetime == 0f) return;
        }

        var refName = snapshot.StatusEffectRef?.Name;
        var label = !string.IsNullOrWhiteSpace(effectName)
            ? effectName!
            : !string.IsNullOrWhiteSpace(refName) ? refName! : "";
        effects.Add(new ItemPresentationEffectSnapshot
        {
            Kind = "status-effect",
            Label = label,
            TargetType = "status-effect",
            TargetRef = snapshot.StatusEffectRef,
            Level = snapshot.Level,
            Source = source,
        });
    }

    private static string BuildEffectsSource(IReadOnlyList<ItemPresentationEffectSnapshot> effects, IReadOnlyDictionary<string, object?> fields)
    {
        foreach (var effect in effects)
        {
            if (effect.Kind == "spell" && !string.IsNullOrWhiteSpace(effect.Label))
            {
                return "Casts " + effect.Label;
            }
        }
        if (!string.IsNullOrWhiteSpace(StringField(fields, "effectName")))
        {
            return "Effect: " + StringField(fields, "effectName");
        }
        return effects.Count == 0 ? "" : "Applies status effects";
    }

    private static List<ItemPresentationDiagnosticSnapshot> BuildDiagnostics(
        IEnumerable<ItemPresentationEffectSnapshot> effects)
    {
        var diagnostics = new List<ItemPresentationDiagnosticSnapshot>();
        foreach (var effect in effects)
        {
            if (effect.TargetType == "status-effect")
            {
                if (effect.TargetRef == null)
                {
                    diagnostics.Add(new ItemPresentationDiagnosticSnapshot
                    {
                        Code = "unresolvedEffectTarget",
                        Field = effect.Source,
                        Message = $"Effect '{effect.Label}' does not have a status-effect reference.",
                    });
                }
                continue;
            }

            if (effect.TargetType == "spell")
            {
                if (effect.TargetRef == null)
                {
                    diagnostics.Add(new ItemPresentationDiagnosticSnapshot
                    {
                        Code = "unresolvedEffectTarget",
                        Field = effect.Source,
                        Message = $"Effect '{effect.Label}' does not have a spell reference.",
                    });
                }
                continue;
            }

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

}
