using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Enchantment;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class EnchantmentExtractorTests
{
    [Fact]
    public void EmitsStatusEffectReference()
    {
        var source = new FakeSource(new[]
        {
            Build(effects: new[]
            {
                new EnchantmentEffectAsset(
                    "StatusEffectEnchantmentEffect",
                    SnapshotRef.LookupAsset("status-guid")),
            }),
        });

        var effect = Assert.Single(Assert.Single(new EnchantmentExtractor(source).Walk()).Fields.Effects);

        Assert.Equal("StatusEffectEnchantmentEffect", effect.Kind);
        Assert.Equal("status-guid", effect.StatusEffectRef?.Guid);
        Assert.Equal(0, effect.Ordinal);
    }

    [Fact]
    public void NonStatusEffectKindHasNoStatusPayload()
    {
        var source = new FakeSource(new[]
        {
            Build(effects: new[]
            {
                new EnchantmentEffectAsset("MeleeParticleEchantmentEffect", SnapshotRef.LookupAsset("wrong-guid")),
            }),
        });

        var effect = Assert.Single(Assert.Single(new EnchantmentExtractor(source).Walk()).Fields.Effects);

        Assert.Equal("MeleeParticleEchantmentEffect", effect.Kind);
        Assert.Null(effect.StatusEffectRef);
    }

    [Fact]
    public void EmitsEffectTooltipText()
    {
        var source = new FakeSource(new[]
        {
            Build(effects: new[]
            {
                new EnchantmentEffectAsset(
                    Kind: "SubTooltipEnchantmentEffect",
                    TooltipSource: "Adds a burning effect"),
            }),
        });

        var effect = Assert.Single(Assert.Single(new EnchantmentExtractor(source).Walk()).Fields.Effects);

        Assert.Equal("Adds a burning effect", effect.TooltipSource);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" \t")]
    public void BlankEffectTooltipYieldsNull(string tooltipSource)
    {
        var source = new FakeSource(new[]
        {
            Build(effects: new[]
            {
                new EnchantmentEffectAsset(
                    Kind: "SubTooltipEnchantmentEffect",
                    TooltipSource: tooltipSource),
            }),
        });

        var effect = Assert.Single(Assert.Single(new EnchantmentExtractor(source).Walk()).Fields.Effects);

        Assert.Null(effect.TooltipSource);
    }

    [Fact]
    public void EmitsAssembledEnchantmentTooltipText()
    {
        var source = new FakeSource(new[]
        {
            Build(tooltipSource: "Adds a burning effect"),
        });

        var fields = Assert.Single(new EnchantmentExtractor(source).Walk()).Fields;

        Assert.Equal("Adds a burning effect", fields.TooltipSource);
    }

    [Fact]
    public void ItemDependentTooltipProducesDiagnosticAndNull()
    {
        var extractor = new EnchantmentExtractor(new FakeSource(new[]
        {
            Build(tooltipDependsOnItem: true),
        }));

        var fields = Assert.Single(extractor.Walk()).Fields;

        Assert.Null(fields.TooltipSource);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("enchantmentTooltipItemDependent", diagnostic.Code);
        Assert.Contains("enchantment-guid", diagnostic.Message);
    }

    [Fact]
    public void BlacklistProducesDiagnosticAndDoesNotBecomeWhitelist()
    {
        var extractor = new EnchantmentExtractor(new FakeSource(new[]
        {
            Build(
                appliesToItemRefs: new[] { SnapshotRef.LookupAsset("allowed-guid") },
                blacklistEntryCount: 1),
        }));

        var row = Assert.Single(extractor.Walk());

        Assert.Single(row.Fields.AppliesToItemRefs);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("enchantmentBlacklistPresent", diagnostic.Code);
        Assert.Contains("enchantment-guid", diagnostic.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" \t")]
    public void BlankEnchantmentNameProducesDiagnostic(string enchantmentName)
    {
        var extractor = new EnchantmentExtractor(new FakeSource(new[] { Build(enchantmentName: enchantmentName) }));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.EnchantmentName);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("enchantmentNameMissing", diagnostic.Code);
        Assert.Equal("enchantmentName", diagnostic.Field);
    }

    private static EnchantmentAsset Build(
        string enchantmentName = "Flame",
        string? tooltipSource = null,
        IReadOnlyList<SnapshotRef>? appliesToItemRefs = null,
        IReadOnlyList<EnchantmentEffectAsset>? effects = null,
        int blacklistEntryCount = 0,
        bool tooltipDependsOnItem = false) => new(
        Guid: "enchantment-guid",
        AssetName: "enchantment",
        EnchantmentName: enchantmentName,
        MoneyValue: 12.5f,
        HideEffectTooltips: false,
        TooltipSource: tooltipSource,
        AppliesToItemRefs: appliesToItemRefs,
        Effects: effects,
        BlacklistEntryCount: blacklistEntryCount,
        TooltipDependsOnItem: tooltipDependsOnItem);

    private sealed class FakeSource : IEnchantmentAssetSource
    {
        private readonly IReadOnlyList<EnchantmentAsset> _assets;
        public FakeSource(IReadOnlyList<EnchantmentAsset> assets) => _assets = assets;
        public IEnumerable<EnchantmentAsset> EnumerateEnchantments() => _assets;
    }
}
