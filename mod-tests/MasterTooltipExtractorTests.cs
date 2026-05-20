using System.Collections.Generic;
using System.Runtime.CompilerServices;
using Ardenfall;
using Ardenfall.Dialog;
using ArdenfallCompendium.MasterTooltip;
using UnityEngine;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class MasterTooltipExtractorTests
{
    [Fact]
    public void EmitsSchemaVersion2WithPositiveAndNegativeColors()
    {
        var snapshot = MasterTooltipExtractor.Build(FakeMasterData.Sample, FakeMasterData.PotionRecipeDescription);

        Assert.Equal(2, snapshot.SchemaVersion);
        Assert.NotEmpty(snapshot.TooltipColors);
        Assert.True(snapshot.TooltipColors.ContainsKey("p"));
        Assert.Equal("positive", snapshot.TooltipColors["p"].Text);
        Assert.Equal("#6FCF6F", snapshot.TooltipColors["p"].Color);
        Assert.True(snapshot.PositiveColor.G > 0);
        Assert.Equal("Learn the potion recipe {0}.", snapshot.PotionRecipeDescription);
    }

    [Fact]
    public void IncludesGlobalTermSetsAndTermColorMatch()
    {
        var snapshot = MasterTooltipExtractor.Build(FakeMasterData.Sample, FakeMasterData.PotionRecipeDescription);

        var termColor = Assert.Single(snapshot.TermSetColors);
        Assert.Equal("term-category-0", termColor.CategoryId);
        Assert.Equal("<color=#FF0000>", termColor.ReplaceWithStart);
        Assert.Equal("}", termColor.End);
        var termSet = Assert.Single(snapshot.GlobalTermSets);
        Assert.Equal(termColor.CategoryId, termSet.CategoryId);
        Assert.Equal("", termSet.TooltipFormat);
        Assert.Equal("bleed=Bleeding/bleeding", Assert.Single(termSet.Terms).Value);
        Assert.False(string.IsNullOrEmpty(snapshot.TermColorMatch));
    }

    [Fact]
    public void IncludesStatGroupingAssetIds()
    {
        var snapshot = MasterTooltipExtractor.Build(FakeMasterData.Sample, FakeMasterData.PotionRecipeDescription);

        Assert.Contains("attr-strength", snapshot.AllAttributes);
        Assert.Contains("skill-heavy-armor", snapshot.AllSkills);
        Assert.Contains("trait-tough", snapshot.AllTraits);
    }

    private static class FakeMasterData
    {
        public const string PotionRecipeDescription = "Learn the potion recipe {0}.";

        public static ArdenfallMasterData Sample
        {
            get
            {
                var master = (ArdenfallMasterData)RuntimeHelpers.GetUninitializedObject(typeof(ArdenfallMasterData));
                master.tooltipCodes = new List<ArdenfallMasterData.TooltipCodes>
                {
                    new() { code = "stamina", text = "Stamina" },
                };
                master.tooltipColors = new List<ArdenfallMasterData.TooltipColor>
                {
                    new() { code = "p", color = new Color(0.435f, 0.812f, 0.435f, 1f), text = "positive" },
                };
                master.tooltipTargetColor = Color.white;
                master.tooltipDurationColor = Color.white;
                master.positiveColor = new Color(0.43f, 0.81f, 0.43f, 1f);
                master.negativeColor = new Color(0.95f, 0.36f, 0.36f, 1f);
                master.spellSubEffectColor = new Color(0.8f, 0.8f, 0.8f, 1f);
                master.enchantmentItemColor = new Color(0.55f, 0.78f, 0.85f, 1f);
                master.primarySpellTooltip = "<b>{0}</b>\n{1}";
                master.secondarySpellTooltip = "<b>Secondary:</b> {0}\n{1}";
                master.unmetSkillMessage = "You lack the required skill: {0}";
                master.brokenDurabilityMessage = "This item is broken.";
                master.ruinedDurabilityMessage = "This item is ruined.";
                master.statBookMessage = "Reading this grants {0}.";
                master.termSetColors = new List<TermSetColor>
                {
                    new()
                    {
                        replaceWithStart = "<color=#FF0000>",
                        replaceWithEnd = "</color>",
                        enableJournalOverride = true,
                        replaceWithStartJournal = "<b>",
                        replaceWithEndJournal = "</b>",
                        start = "{",
                        end = "}",
                    },
                };
                master.globalTermSets = new List<TermSetContainer>
                {
                    new()
                    {
                        terms = new TermSet
                        {
                            terms = new List<Term>
                            {
                                new() { value = "bleed=Bleeding/bleeding", definition = "Bleed" },
                            },
                        },
                    },
                };
                master.termColorMatch = "\\b({0})\\b";
                master.allAttributes = new List<StatType> { StatType("attr-strength", "Strength") };
                master.allSkills = new List<StatType> { StatType("skill-heavy-armor", "Heavy Armor") };
                master.allTraits = new List<TraitType> { TraitType("trait-tough", "Tough") };
                return master;
            }
        }

        private static StatType StatType(string id, string name)
        {
            var stat = (StatType)RuntimeHelpers.GetUninitializedObject(typeof(StatType));
            stat.id = id;
            stat.statName = name;
            return stat;
        }

        private static TraitType TraitType(string id, string name)
        {
            var trait = (TraitType)RuntimeHelpers.GetUninitializedObject(typeof(TraitType));
            trait.id = id;
            trait.traitName = name;
            return trait;
        }
    }
}
