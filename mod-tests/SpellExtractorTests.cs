using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using Ardenfall;
using ArdenfallCompendium.Entities.Spell;
using UnityEngine;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class SpellExtractorTests
{
    [Fact]
    public void TooltipYieldsText()
    {
        var source = new FakeSpellAssetSource(new[]
        {
            Build("spell_tooltip", "Tooltip Spell", "Reduces Target's Vision on Touch"),
        });

        var row = Assert.Single(new SpellExtractor(source).Walk());

        Assert.Equal("Reduces Target's Vision on Touch", row.Fields.TooltipSource);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" \t")]
    public void NullOrWhitespaceTooltipYieldsNullWithoutDiagnostic(string? tooltipSource)
    {
        var source = new FakeSpellAssetSource(new[]
        {
            Build("spell_no-tooltip", "No Tooltip", tooltipSource),
        });
        var extractor = new SpellExtractor(source);

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.TooltipSource);
        Assert.DoesNotContain(extractor.Diagnostics, diagnostic => diagnostic.Field == "tooltipSource");
    }

    [Fact]
    public void ExtractsEverySpellWithContractFieldsAndNamedId()
    {
        var source = new FakeSpellAssetSource(new[]
        {
            new SpellAsset(
                Guid: "spell-guid",
                AssetName: "spell_fire-shield",
                SpellName: "Fire Shield",
                StatTypeRef: null,
                ManaCost: 12.5f,
                IsIllegal: true,
                IconRef: null),
        });

        var extractor = new SpellExtractor(source);
        var rows = extractor.Walk().ToList();

        var row = Assert.Single(rows);
        Assert.Equal("named;spell;spell_fire-shield", row.Id);
        Assert.Equal("Fire Shield", row.Fields.SpellName);
        Assert.DoesNotContain(extractor.Diagnostics, diagnostic => diagnostic.Code == "spellNameMissing");
        Assert.Equal(12.5f, row.Fields.ManaCost);
        Assert.True(row.Fields.IsIllegal);
    }

    [Fact]
    public void EmptyAssetNameIsFatal()
    {
        var source = new FakeSpellAssetSource(new[]
        {
            Build(" ", "Unnamed"),
        });
        var extractor = new SpellExtractor(source);

        Assert.Empty(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics, d => d.Code == "namedAssetNameMissing");
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Contains("SpellData", diagnostic.Message);
        Assert.Contains("' '", diagnostic.Message);
    }

    [Fact]
    public void DuplicateAssetNameIsFatal()
    {
        var source = new FakeSpellAssetSource(new[]
        {
            Build("spell_same", "First"),
            Build("spell_same", "Second"),
        });
        var extractor = new SpellExtractor(source);

        Assert.Single(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics, d => d.Code == "namedAssetNameDuplicate");
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Contains("SpellData", diagnostic.Message);
        Assert.Contains("'spell_same'", diagnostic.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" \t")]
    public void EmptyOrWhitespaceSpellNameProducesRowAndDiagnostic(string spellName)
    {
        var source = new FakeSpellAssetSource(new[]
        {
            Build("spell_missing-name", spellName),
        });
        var extractor = new SpellExtractor(source);

        var row = Assert.Single(extractor.Walk().ToList());

        Assert.Null(row.Fields.SpellName);
        var diagnostic = Assert.Single(extractor.Diagnostics);
        Assert.Equal("diagnostic", diagnostic.Severity);
        Assert.Equal("spellNameMissing", diagnostic.Code);
        Assert.Equal("spellName", diagnostic.Field);
        Assert.Contains("named;spell;spell_missing-name", diagnostic.Message);
    }

    [Fact]
    public void LoadedSpellSourceOrdersAndDeduplicatesAuthoredAssets()
    {
        var first = RuntimeSpell("one", "Zed");
        var second = RuntimeSpell("two", "Alpha");
        var source = new LoadedSpellAssetSource(
            loadedSpells: () => new[] { first, second, first },
            isUnityNull: _ => false,
            assetName: asset => ReferenceEquals(asset, first) ? "Zed" : "Alpha",
            isAuthoredAsset: _ => true);

        var firstCall = source.EnumerateSpells().Select(asset => asset.AssetName).ToList();
        var secondCall = source.EnumerateSpells().Select(asset => asset.AssetName).ToList();

        Assert.Equal(new[] { "Alpha", "Zed" }, firstCall);
        Assert.Equal(firstCall, secondCall);
    }

    private sealed class FakeSpellAssetSource : ISpellAssetSource
    {
        private readonly IReadOnlyList<SpellAsset> _assets;

        public FakeSpellAssetSource(IReadOnlyList<SpellAsset> assets)
        {
            _assets = assets;
        }

        public IEnumerable<SpellAsset> EnumerateSpells() => _assets;

    }

    private static SpellAsset Build(
        string assetName,
        string spellName,
        string? tooltipSource = null) => new(
        Guid: null,
        AssetName: assetName,
        SpellName: spellName,
        StatTypeRef: null,
        ManaCost: 0f,
        IsIllegal: false,
        IconRef: null,
        TooltipSource: tooltipSource);

    private static SpellData RuntimeSpell(string id, string name)
    {
        var spell = (SpellData)RuntimeHelpers.GetUninitializedObject(typeof(SpellData));
        spell.spellName = name;
        spell.manaCost = 1f;
        spell.isIlligal = false;
        return spell;
    }
}
