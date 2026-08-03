using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.StatusEffect;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class StatusEffectExtractorTests
{
    [Fact]
    public void TooltipYieldsText()
    {
        var source = new FakeStatusEffectAssetSource(new[]
        {
            Build("guid-status-tooltip", "Bleeding", "Adds 1% Bleed Damage Resistance to Target over 1 Seconds"),
        });

        var row = Assert.Single(new StatusEffectExtractor(source).Walk());

        Assert.Equal("Adds 1% Bleed Damage Resistance to Target over 1 Seconds", row.Fields.TooltipSource);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" \t")]
    public void NullOrWhitespaceTooltipYieldsNull(string? tooltipSource)
    {
        var source = new FakeStatusEffectAssetSource(new[]
        {
            Build("guid-status-no-tooltip", "No Tooltip", tooltipSource),
        });

        var row = Assert.Single(new StatusEffectExtractor(source).Walk());

        Assert.Null(row.Fields.TooltipSource);
    }

    [Fact]
    public void EmptyNameProducesDiagnosticAndKeepsRow()
    {
        var source = new FakeStatusEffectAssetSource(new[] { Build("guid-status-empty", " ") });
        var extractor = new StatusEffectExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("guid-status-empty", row.Id);
        Assert.Null(row.Fields.StatusEffectName);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("diagnostic", diagnostic.Severity);
        Assert.Equal("statusEffectNameMissing", diagnostic.Code);
        Assert.Equal("statusEffectName", diagnostic.Field);
    }

    [Fact]
    public void MissingLookupGuidIsFatalAndDropsRow()
    {
        var source = new FakeStatusEffectAssetSource(new[] { Build(null, "Missing Guid") });
        var extractor = new StatusEffectExtractor(source);

        Assert.Empty(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Equal("lookupAssetGuidMissing", diagnostic.Code);
        Assert.Equal("id", diagnostic.Field);
    }

    private sealed class FakeStatusEffectAssetSource : IStatusEffectAssetSource
    {
        private readonly IReadOnlyList<StatusEffectAsset> _assets;

        public FakeStatusEffectAssetSource(IReadOnlyList<StatusEffectAsset> assets)
        {
            _assets = assets;
        }

        public IEnumerable<StatusEffectAsset> EnumerateStatusEffects() => _assets;
    }

    private static StatusEffectAsset Build(
        string? guid,
        string name,
        string? tooltipSource = null) => new(
        Guid: guid,
        AssetName: "status_effect_asset",
        StatusEffectName: name,
        TooltipSource: tooltipSource,
        IconRef: null,
        IsHostile: false);

}
