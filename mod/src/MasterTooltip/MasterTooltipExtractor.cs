using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Ardenfall;
using Ardenfall.Dialog;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.MasterTooltip;

public interface IMasterTooltipSnapshotSource
{
    MasterTooltipVocabularySnapshot BuildSnapshot();
}

public sealed class RuntimeMasterTooltipSnapshotSource : IMasterTooltipSnapshotSource
{
    public static readonly RuntimeMasterTooltipSnapshotSource Instance = new();

    private RuntimeMasterTooltipSnapshotSource()
    {
    }

    public MasterTooltipVocabularySnapshot BuildSnapshot()
    {
        var potionRecipeDescription = WorldSingleton<PotionRecipeManager>.Instance != null
            ? WorldSingleton<PotionRecipeManager>.Instance.potionRecipeDescription
            : "";
        return MasterTooltipExtractor.Build(ArdenfallMasterData.Instance, potionRecipeDescription);
    }
}

public static class MasterTooltipExtractor
{
    public static MasterTooltipVocabularySnapshot Build(ArdenfallMasterData master, string? potionRecipeDescription)
    {
        if (ReferenceEquals(master, null)) throw new ArgumentNullException(nameof(master));

        var termSetColors = BuildTermSetColors(master.termSetColors);
        var categoryIds = BuildCategoryIdMap(master.termSetColors, termSetColors);

        return new MasterTooltipVocabularySnapshot
        {
            SchemaVersion = 2,
            TooltipCodes = (master.tooltipCodes ?? new List<ArdenfallMasterData.TooltipCodes>())
                .Where(c => c != null && !string.IsNullOrEmpty(c.code))
                .ToDictionary(c => c.code, c => c.text ?? ""),
            TooltipColors = (master.tooltipColors ?? new List<ArdenfallMasterData.TooltipColor>())
                .Where(c => c != null && !string.IsNullOrEmpty(c.code))
                .ToDictionary(
                    c => c.code,
                    c => new MasterTooltipColorTokenSnapshot
                    {
                        Color = ToHex(c.color),
                        Text = c.text ?? "",
                    }),
            TooltipTargetColor = AssetColorSnapshot.FromColor(master.tooltipTargetColor),
            TooltipDurationColor = AssetColorSnapshot.FromColor(master.tooltipDurationColor),
            PositiveColor = AssetColorSnapshot.FromColor(master.positiveColor),
            NegativeColor = AssetColorSnapshot.FromColor(master.negativeColor),
            SpellSubEffectColor = AssetColorSnapshot.FromColor(master.spellSubEffectColor),
            EnchantmentItemColor = AssetColorSnapshot.FromColor(master.enchantmentItemColor),
            PrimarySpellTooltip = master.primarySpellTooltip ?? "",
            SecondarySpellTooltip = master.secondarySpellTooltip ?? "",
            UnmetSkillMessage = master.unmetSkillMessage ?? "",
            BrokenDurabilityMessage = master.brokenDurabilityMessage ?? "",
            RuinedDurabilityMessage = master.ruinedDurabilityMessage ?? "",
            StatBookMessage = master.statBookMessage ?? "",
            TermSetColors = termSetColors,
            GlobalTermSets = BuildGlobalTermSets(master.globalTermSets, categoryIds, termSetColors),
            TermColorMatch = master.termColorMatch ?? "",
            PotionRecipeDescription = potionRecipeDescription ?? "",
        };
    }

    private static List<MasterTooltipTermSetColorSnapshot> BuildTermSetColors(List<TermSetColor>? colors)
    {
        var snapshots = new List<MasterTooltipTermSetColorSnapshot>();
        if (colors == null) return snapshots;

        for (var i = 0; i < colors.Count; i++)
        {
            var color = colors[i];
            if (color == null) continue;
            snapshots.Add(new MasterTooltipTermSetColorSnapshot
            {
                CategoryId = CategoryId(color.category, i),
                ReplaceWithStart = color.replaceWithStart ?? "",
                ReplaceWithEnd = color.replaceWithEnd ?? "",
                EnableJournalOverride = color.enableJournalOverride,
                ReplaceWithStartJournal = color.replaceWithStartJournal ?? "",
                ReplaceWithEndJournal = color.replaceWithEndJournal ?? "",
                Start = color.start ?? "",
                End = color.end ?? "",
            });
        }

        return snapshots;
    }

    private static Dictionary<TermSetCategory, string> BuildCategoryIdMap(
        List<TermSetColor>? colors,
        IReadOnlyList<MasterTooltipTermSetColorSnapshot> snapshots)
    {
        var categoryIds = new Dictionary<TermSetCategory, string>();
        if (colors == null) return categoryIds;

        var snapshotIndex = 0;
        for (var i = 0; i < colors.Count; i++)
        {
            var color = colors[i];
            if (color == null) continue;
            if (color.category != null && !categoryIds.ContainsKey(color.category))
            {
                categoryIds[color.category] = snapshots[snapshotIndex].CategoryId;
            }
            snapshotIndex++;
        }

        return categoryIds;
    }

    private static List<MasterTooltipTermSetSnapshot> BuildGlobalTermSets(
        List<TermSetContainer>? sets,
        IReadOnlyDictionary<TermSetCategory, string> categoryIds,
        IReadOnlyList<MasterTooltipTermSetColorSnapshot> termSetColors)
    {
        var snapshots = new List<MasterTooltipTermSetSnapshot>();
        if (sets == null) return snapshots;

        for (var i = 0; i < sets.Count; i++)
        {
            var set = sets[i];
            if (set == null) continue;
            var categoryId = ResolveCategoryId(set.category, i, categoryIds, termSetColors);
            var terms = set.TermSet?.terms ?? new List<Term>();
            var termSnapshots = terms
                .Where(t => t != null)
                .Select(t => new MasterTooltipTermSnapshot
                {
                    Value = t.value ?? "",
                    Definition = t.definition ?? "",
                })
                .ToList();
            snapshots.Add(new MasterTooltipTermSetSnapshot
            {
                SetId = TermSetId(categoryId, termSnapshots, i),
                CategoryId = categoryId,
                TooltipFormat = set.TooltipFormat ?? "",
                Terms = termSnapshots,
            });
        }

        return snapshots;
    }

    private static string ResolveCategoryId(
        TermSetCategory? category,
        int index,
        IReadOnlyDictionary<TermSetCategory, string> categoryIds,
        IReadOnlyList<MasterTooltipTermSetColorSnapshot> termSetColors)
    {
        if (category != null && categoryIds.TryGetValue(category, out var categoryId)) return categoryId;
        if (category == null && termSetColors.Count == 1) return termSetColors[0].CategoryId;
        return CategoryId(category, index);
    }

    private static string CategoryId(TermSetCategory? category, int fallbackIndex)
    {
        if (category != null)
        {
            var guid = BuiltLookupTable.Instance != null ? BuiltLookupTable.Instance.GetGuid(category) : null;
            if (!string.IsNullOrWhiteSpace(guid)) return guid;
            if (!string.IsNullOrWhiteSpace(category.name)) return NormalizeId(category.name);
        }

        return "term-category-" + fallbackIndex;
    }

    private static string TermSetId(string categoryId, IReadOnlyList<MasterTooltipTermSnapshot> terms, int fallbackIndex)
    {
        var firstValue = terms.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t.Value))?.Value;
        if (!string.IsNullOrWhiteSpace(firstValue)) return NormalizeId(firstValue) + "-" + fallbackIndex;
        return categoryId + "-set-" + fallbackIndex;
    }

    private static string NormalizeId(string value)
    {
        var builder = new StringBuilder(value.Length);
        var needsDash = false;
        foreach (var ch in value)
        {
            if (char.IsLetterOrDigit(ch))
            {
                if (needsDash && builder.Length > 0) builder.Append('-');
                builder.Append(char.ToLowerInvariant(ch));
                needsDash = false;
            }
            else
            {
                needsDash = true;
            }
        }

        return builder.Length == 0 ? "term" : builder.ToString();
    }

    private static string ToHex(Color color) =>
        "#" + ToByte(color.r).ToString("X2") + ToByte(color.g).ToString("X2") + ToByte(color.b).ToString("X2");

    private static int ToByte(float value)
    {
        if (float.IsNaN(value)) return 0;
        if (value <= 0f) return 0;
        if (value >= 1f) return 255;
        return (int)Math.Round(value * 255f, MidpointRounding.AwayFromZero);
    }
}
