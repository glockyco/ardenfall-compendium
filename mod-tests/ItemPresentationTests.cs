using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.Item.Adapters;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class ItemPresentationTests
{
    [Fact]
    public void BuilderUsesDeterministicBaseRenderContext()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Iron Sword",
            ["description"] = "A simple iron blade.",
            ["value"] = 25,
            ["weight"] = 3.5f,
            ["damage"] = 7.5f,
            ["meleeDurabilityMax"] = 100,
            ["hardAttackDamMult"] = 1.5f,
            ["minimumSkill"] = 5,
            ["statType"] = "Strength",
        };
        var provenance = new Dictionary<string, Provenance>
        {
            ["name"] = new()
            {
                Kind = "parameter",
                Source = "GetItemName()",
                IsSet = true,
                Inherited = false,
            },
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-iron-sword",
            variantId: "melee-weapon",
            fields,
            provenance);

        Assert.Equal(1, presentation.SchemaVersion);
        Assert.Equal("item-presentation-v1", presentation.RenderContext);
        Assert.Equal("Iron Sword", presentation.DisplayName);
        Assert.Equal("GetItemName()", presentation.DisplayNameSourceMethod);
        Assert.Equal("Melee weapon", presentation.ItemType);
        Assert.Equal("variant:melee-weapon", presentation.ItemTypeSourceMethod);
        Assert.Equal("A simple iron blade.", presentation.DescriptionSource);
        Assert.Equal(25, presentation.Value);
        Assert.Equal(3.5f, presentation.Weight);
        Assert.Contains(presentation.StatRows, row =>
            row.Id == "damage" && row.Label == "Base damage" && row.ValueText == "7.5" && row.Comparison == null);
        Assert.Contains(presentation.StatRows, row =>
            row.Id == "heavyAttackDamage" && row.Label == "Heavy Attack Damage" && row.ValueText == "11.25");
        Assert.Equal("max-durability", presentation.Durability?.Kind);
        Assert.Contains(presentation.Requirements, row =>
            row.Id == "minimum-skill" && row.Label == "Strength" && row.ValueText == "5");
        Assert.Equal(100, presentation.Durability?.Max);
        Assert.DoesNotContain(presentation.StateFacts, fact => fact.Kind == "canonical-state");
    }

    [Fact]
    public void BuilderDoesNotSynthesizePlayerInventoryOrMerchantState()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Stamina Draught",
            ["description"] = "Drink to restore stamina.",
            ["quickslotCooldownTime"] = 12.5f,
            ["stackable"] = true,
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-stamina-draught",
            variantId: "consumable",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.All(presentation.StatRows, row => Assert.Null(row.Comparison));
        Assert.DoesNotContain(presentation.StateFacts, fact => fact.Kind.Contains("merchant"));
        Assert.DoesNotContain(presentation.StateFacts, fact => fact.Kind.Contains("inventory"));
        Assert.Contains(presentation.StateFacts, fact =>
            fact.Kind == "stacking" && fact.Label == "Stackable");
    }

    [Fact]
    public void BuilderHidesAmbiguousRequirementsAndZeroDurability()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Unresolved Slate",
            ["description"] = "",
            ["minimumSkill"] = 40,
            ["durabilityMax"] = 0,
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-slate",
            variantId: "slate-spell",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Empty(presentation.Requirements);
        Assert.Null(presentation.Durability);
        Assert.DoesNotContain(presentation.StateFacts, fact => fact.Kind == "canonical-state");
    }

    [Fact]
    public void BuilderUsesGameTooltipLabelForArmorRating()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Leather Tunic",
            ["description"] = "",
            ["armorRating"] = 12,
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-leather-tunic",
            variantId: "armor",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Contains(presentation.StatRows, row =>
            row.Id == "armorRating" && row.Label == "Damage Threshold" && row.ValueText == "12");
    }

    [Fact]
    public void BuilderDerivesSafeEffectFactsFromExtractedFields()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Spark Slate",
            ["description"] = "Casts a spell.",
            ["spellDataJson"] = new Dictionary<string, object?>
            {
                ["id"] = "fixture-spark",
                ["name"] = "Spark",
            },
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-slate-spell",
            variantId: "slate-spell",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Equal("Casts Spark", presentation.EffectsSource);
        Assert.Contains(presentation.Effects, effect =>
            effect.Kind == "spell" &&
            effect.Label == "Spark" &&
            effect.TargetType == "spell" &&
            effect.TargetId == "fixture-spark");
    }

    [Fact]
    public void BuilderEmitsEachConsumableStatusEffectWithReferenceAndLevel()
    {
        var haste = SnapshotRef.LookupAsset("status-haste", "Ardenfall.StatusEffectData", "Attack Speed");
        var resistance = SnapshotRef.LookupAsset("status-resistance", "Ardenfall.StatusEffectData", "Bleed Resistance");
        var fields = new Dictionary<string, object?>
        {
            ["effectName"] = "Attack Speed I",
            ["statusEffectsJson"] = new List<LeveledStatusEffectSnapshot>
            {
                new(haste, 1, 30, null),
                new(resistance, 3, 30, null),
            },
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-consumable",
            variantId: "consumable",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Equal(2, presentation.Effects.Count);
        Assert.Collection(
            presentation.Effects,
            first =>
            {
                Assert.Equal("status-haste", first.TargetRef?.Guid);
                Assert.Equal(1, first.Level);
                Assert.Equal("Attack Speed I", first.Label);
                Assert.Equal("statusEffectsJson", first.Source);
                Assert.Null(first.TargetId);
            },
            second =>
            {
                Assert.Equal("status-resistance", second.TargetRef?.Guid);
                Assert.Equal(3, second.Level);
                Assert.Equal("Attack Speed I", second.Label);
                Assert.Equal("statusEffectsJson", second.Source);
                Assert.Null(second.TargetId);
            });
    }

    [Fact]
    public void BuilderEmitsBleedStatusEffectAsOneFact()
    {
        var bleed = SnapshotRef.LookupAsset("status-bleed", "Ardenfall.StatusEffectData", "Bleed");
        var fields = new Dictionary<string, object?>
        {
            ["bleedStatusEffectJson"] = new LeveledStatusEffectSnapshot(bleed, 2.5f, 10, null),
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-bow",
            variantId: "bow",
            fields,
            provenance: new Dictionary<string, Provenance>());

        var effect = Assert.Single(presentation.Effects);
        Assert.Equal("status-bleed", effect.TargetRef?.Guid);
        Assert.Equal(2.5f, effect.Level);
        Assert.Equal("Bleed", effect.Label);
        Assert.Equal("bleedStatusEffectJson", effect.Source);
        Assert.Null(effect.TargetId);
    }

    [Fact]
    public void BuilderEmitsNoStatusEffectsWhenSnapshotListIsEmpty()
    {
        var fields = new Dictionary<string, object?>
        {
            ["statusEffectsJson"] = new List<LeveledStatusEffectSnapshot>(),
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-empty-consumable",
            variantId: "consumable",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Empty(presentation.Effects);
        Assert.Empty(presentation.Diagnostics);
    }

    [Fact]
    public void BuilderKeepsStatusEffectFactWhenReferenceIsNull()
    {
        var fields = new Dictionary<string, object?>
        {
            ["statusEffectsJson"] = new List<LeveledStatusEffectSnapshot>
            {
                new(null, 4, 30, null),
            },
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-unresolved-consumable",
            variantId: "consumable",
            fields,
            provenance: new Dictionary<string, Provenance>());

        var effect = Assert.Single(presentation.Effects);
        Assert.Null(effect.TargetRef);
        Assert.Equal(4, effect.Level);
        Assert.Equal("statusEffectsJson", effect.Source);
        var diagnostic = Assert.Single(presentation.Diagnostics);
        Assert.Equal("statusEffectsJson", diagnostic.Field);
        Assert.Equal("unresolvedEffectTarget", diagnostic.Code);
    }

    [Fact]
    public void BuilderSkipsUnconfiguredLeveledStatusEffect()
    {
        // bleedStatusEffect is a Parameter with a default instance, so a weapon that never
        // configured bleed still carries an empty snapshot. It applies nothing, so it is not
        // an effect and it is not an unresolved reference either.
        var fields = new Dictionary<string, object?>
        {
            ["bleedStatusEffectJson"] = new LeveledStatusEffectSnapshot(null, 0f, 0f, null),
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-plain-sword",
            variantId: "melee-weapon",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Empty(presentation.Effects);
        Assert.Empty(presentation.Diagnostics);
    }

    [Fact]
    public void BuilderUsesLeveledSpellSnapshotNameForSlateEffects()
    {
        var fields = new Dictionary<string, object?>
        {
            ["name"] = "Scroll of Spark",
            ["description"] = "",
            ["spellDataJson"] = new LeveledSpellDataSnapshot(
                SpellRef: null,
                SpellName: "Spark",
                Level: 2,
                SecondaryLevel: 2,
                SubSpells: new List<SubSpellSnapshot>()),
        };

        var presentation = ItemPresentationBuilder.FromExtractedFields(
            rowId: "fixture-slate",
            variantId: "slate-spell",
            fields,
            provenance: new Dictionary<string, Provenance>());

        Assert.Equal("Casts Spark", presentation.EffectsSource);
        Assert.Contains(presentation.Effects, effect =>
            effect.Kind == "spell" &&
            effect.Label == "Spark" &&
            effect.TargetType == "spell");
    }
}
