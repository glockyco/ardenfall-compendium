using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.CharacterRace;
using ArdenfallCompendium.Entities.NameSet;
using ArdenfallCompendium.Extraction;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class CharacterRaceNameSetTests
{
    [Fact]
    public void CharacterRacePreservesNameSetOrder()
    {
        var extractor = new CharacterRaceExtractor(new CharacterRaceSource(new CharacterRaceAsset(
            AssetName: "Karu Elf",
            RaceName: "Karu Elf",
            NameSetAssetNames: new[] { "Karu Elf Given", "Karu Elf Family" })));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("named;character-race;Karu Elf", row.Id);
        Assert.Equal("Karu Elf", row.Fields.RaceName);
        Assert.Collection(
            row.Fields.NameSetRefs,
            first =>
            {
                Assert.Equal("name-set", first.Entity);
                Assert.Equal("Karu Elf Given", first.Name);
            },
            second =>
            {
                Assert.Equal("name-set", second.Entity);
                Assert.Equal("Karu Elf Family", second.Name);
            });
    }

    [Fact]
    public void CharacterRaceWithoutNameSetsProducesEmptyReferences()
    {
        var extractor = new CharacterRaceExtractor(new CharacterRaceSource(new CharacterRaceAsset(
            AssetName: "Human",
            RaceName: "Human",
            NameSetAssetNames: null)));

        var row = Assert.Single(extractor.Walk());

        Assert.Empty(row.Fields.NameSetRefs);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void NameSetPreservesSeedWeightsAndGenerationOrder()
    {
        var extractor = new NameSetExtractor(new NameSetSource(new NameSetAsset(
            AssetName: "Karu Elf Given",
            Seeds: new[]
            {
                new NameSetSeedAsset("Ari", 7),
                new NameSetSeedAsset("Bela", 3),
            },
            GenerationOrder: 5)));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("named;name-set;Karu Elf Given", row.Id);
        Assert.Equal(5, row.Fields.GenerationOrder);
        Assert.Collection(
            row.Fields.Seeds,
            first =>
            {
                Assert.Equal("Ari", first.Name);
                Assert.Equal(7, first.Weight);
            },
            second =>
            {
                Assert.Equal("Bela", second.Name);
                Assert.Equal(3, second.Weight);
            });
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void ExtractionServicesCacheRowsPerRunAndEvict()
    {
        var raceSource = new CountingCharacterRaceSource(new CharacterRaceAsset("Human", "Human", null));
        var nameSetSource = new CountingNameSetSource(new NameSetAsset("Human Names", new List<NameSetSeedAsset>(), 5));
        var raceService = new CharacterRaceExtractionService(raceSource);
        var nameSetService = new NameSetExtractionService(nameSetSource);
        var run = new CompendiumRun { RunId = "run" };

        Assert.Same(raceService.GetOrExtract(run), raceService.GetOrExtract(run));
        Assert.Same(nameSetService.GetOrExtract(run), nameSetService.GetOrExtract(run));
        Assert.Equal(1, raceSource.EnumerationCount);
        Assert.Equal(1, nameSetSource.EnumerationCount);

        raceService.Evict(run);
        nameSetService.Evict(run);
        _ = raceService.GetOrExtract(run);
        _ = nameSetService.GetOrExtract(run);
        Assert.Equal(2, raceSource.EnumerationCount);
        Assert.Equal(2, nameSetSource.EnumerationCount);
    }

    private sealed class CharacterRaceSource : ICharacterRaceAssetSource
    {
        private readonly IReadOnlyList<CharacterRaceAsset> _assets;

        public CharacterRaceSource(params CharacterRaceAsset[] assets) => _assets = assets;

        public IEnumerable<CharacterRaceAsset> EnumerateCharacterRaces() => _assets;
    }

    private sealed class NameSetSource : INameSetAssetSource
    {
        private readonly IReadOnlyList<NameSetAsset> _assets;

        public NameSetSource(params NameSetAsset[] assets) => _assets = assets;

        public IEnumerable<NameSetAsset> EnumerateNameSets() => _assets;
    }

    private sealed class CountingCharacterRaceSource : ICharacterRaceAssetSource
    {
        private readonly CharacterRaceAsset _asset;

        public CountingCharacterRaceSource(CharacterRaceAsset asset) => _asset = asset;

        public int EnumerationCount { get; private set; }

        public IEnumerable<CharacterRaceAsset> EnumerateCharacterRaces()
        {
            EnumerationCount++;
            yield return _asset;
        }
    }

    private sealed class CountingNameSetSource : INameSetAssetSource
    {
        private readonly NameSetAsset _asset;

        public CountingNameSetSource(NameSetAsset asset) => _asset = asset;

        public int EnumerationCount { get; private set; }

        public IEnumerable<NameSetAsset> EnumerateNameSets()
        {
            EnumerationCount++;
            yield return _asset;
        }
    }
}
