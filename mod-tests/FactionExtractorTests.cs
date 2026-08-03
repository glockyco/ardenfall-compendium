using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Faction;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class FactionExtractorTests
{
    [Fact]
    public void ExtractsFlatFactionFields()
    {
        var extractor = new FactionExtractor(new FakeSource(new FactionAssetRecord(
            Guid: "faction-guid",
            AssetName: "Black Moth",
            Title: "Black Moth",
            FactionId: "blackmoth",
            Description: "A hidden order.",
            IconRef: SnapshotRef.LookupAsset("icon-guid", "UnityEngine.Sprite", "black-moth"),
            Alliable: true,
            EnableReputation: true,
            AlwaysShowInUI: false,
            CanBeDisguised: true,
            EnableBounty: false,
            InterFactionRelationships: new List<FactionRelationshipRecord?>())));

        var row = Assert.Single(extractor.Walk());

        Assert.Equal("faction-guid", row.Id);
        Assert.Equal("Black Moth", row.Fields.Name);
        Assert.Equal("blackmoth", row.Fields.FactionId);
        Assert.Equal("A hidden order.", row.Fields.Description);
        Assert.True(row.Fields.Alliable);
        Assert.True(row.Fields.EnableReputation);
        Assert.False(row.Fields.AlwaysShowInUI);
        Assert.True(row.Fields.CanBeDisguised);
        Assert.False(row.Fields.EnableBounty);
        Assert.Empty(row.Fields.InterFactionRelationships);
        Assert.Empty(row.Diagnostics);
    }

    [Fact]
    public void EmptyTitleProducesNullAndNameDiagnostic()
    {
        var extractor = new FactionExtractor(new FakeSource(new FactionAssetRecord(
            Guid: "nameless-faction",
            AssetName: "Nameless Faction",
            Title: " ",
            FactionId: "nameless",
            Description: "",
            IconRef: null,
            Alliable: false,
            EnableReputation: false,
            AlwaysShowInUI: false,
            CanBeDisguised: false,
            EnableBounty: false,
            InterFactionRelationships: new List<FactionRelationshipRecord?>())));

        var row = Assert.Single(extractor.Walk());

        Assert.Null(row.Fields.Name);
        var diagnostic = Assert.Single(row.Diagnostics);
        Assert.Equal("factionNameMissing", diagnostic.Code);
        Assert.Equal("name", diagnostic.Field);
    }

    [Fact]
    public void EmitsEnemyAndNegativeStandingRelationshipShapes()
    {
        var extractor = new FactionExtractor(new FakeSource(new FactionAssetRecord(
            Guid: "faction-guid",
            AssetName: "Black Moth",
            Title: "Black Moth",
            FactionId: "blackmoth",
            Description: null,
            IconRef: null,
            Alliable: false,
            EnableReputation: true,
            AlwaysShowInUI: true,
            CanBeDisguised: false,
            EnableBounty: true,
            InterFactionRelationships: new List<FactionRelationshipRecord?>
            {
                new(SnapshotRef.LookupAsset("enemy-guid", "Ardenfall.Faction", "Enemy"), -100, true),
                new(SnapshotRef.LookupAsset("standing-guid", "Ardenfall.Faction", "Standing"), -600, false),
            })));

        var row = Assert.Single(extractor.Walk());

        Assert.Collection(
            row.Fields.InterFactionRelationships,
            enemy =>
            {
                Assert.Equal("enemy-guid", enemy.Faction?.Guid);
                Assert.Equal(-100, enemy.Relationship);
                Assert.True(enemy.IsEnemy);
            },
            standing =>
            {
                Assert.Equal("standing-guid", standing.Faction?.Guid);
                Assert.Equal(-600, standing.Relationship);
                Assert.False(standing.IsEnemy);
            });
    }

    [Fact]
    public void PositiveStandingWithoutEnemyFlagFailsFast()
    {
        var extractor = new FactionExtractor(new FakeSource(new FactionAssetRecord(
            Guid: "faction-guid",
            AssetName: "Black Moth",
            Title: "Black Moth",
            FactionId: "blackmoth",
            Description: null,
            IconRef: null,
            Alliable: false,
            EnableReputation: true,
            AlwaysShowInUI: true,
            CanBeDisguised: false,
            EnableBounty: false,
            InterFactionRelationships: new List<FactionRelationshipRecord?>
            {
                new(SnapshotRef.LookupAsset("friendly-guid", "Ardenfall.Faction", "Friendly"), 100, false),
            })));

        Assert.Throws<System.InvalidOperationException>(() => extractor.Walk().ToList());
    }

    private sealed class FakeSource : IFactionAssetSource
    {
        private readonly IReadOnlyList<FactionAssetRecord> _assets;

        public FakeSource(params FactionAssetRecord[] assets)
        {
            _assets = assets;
        }

        public IEnumerable<FactionAssetRecord> EnumerateFactions() => _assets;
    }
}
