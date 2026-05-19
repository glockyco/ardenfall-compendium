using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
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
            row.Id == "damage" && row.Label == "Damage" && row.ValueText == "7.5" && row.Comparison == null);
        Assert.Equal("max-durability", presentation.Durability?.Kind);
        Assert.Equal(100, presentation.Durability?.Max);
        Assert.Contains(presentation.StateFacts, fact => fact.Kind == "canonical-state");
        Assert.Contains(presentation.Omissions, omission => omission.Code == "equippedComparisonOmitted");
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
}
