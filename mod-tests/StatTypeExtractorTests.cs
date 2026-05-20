using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatType;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class StatTypeExtractorTests
{
    [Fact]
    public void ExtractsEveryStatTypeWithGuidAndName()
    {
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.Build(
                guid: "stat-strength",
                name: "Strength",
                isAttribute: true,
                statDescription: "Raw power.",
                longStatDescription: "Raw power. Affects melee damage and carry weight.",
                affects: new[] { "melee-damage" },
                skillAffects: new[] { "heavy-armor", "blade" }),
            FakeStatTypeAssetSource.Build(
                guid: "skill-blade",
                name: "Blade",
                isAttribute: false,
                statDescription: "Blade skill.",
                longStatDescription: "Blade skill. ..."),
        });
        var extractor = new StatTypeExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Equal(2, rows.Count);
        Assert.Equal("stat-strength", rows[0].Id);
        Assert.Equal("Strength", rows[0].Fields.StatName);
        Assert.True(rows[0].Fields.IsAttribute);
        Assert.Contains("melee-damage", rows[0].Fields.Affects);
        Assert.False(rows[1].Fields.IsAttribute);
    }

    [Fact]
    public void DiagnosesAssetMissingGuid()
    {
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.BuildWithoutGuid("Floating Stat"),
        });
        var extractor = new StatTypeExtractor(source);

        var rows = extractor.Walk().ToList();

        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics, d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }

    private sealed class FakeStatTypeAssetSource : IStatTypeAssetSource
    {
        private readonly IReadOnlyList<StatTypeAsset> _assets;

        public FakeStatTypeAssetSource(IReadOnlyList<StatTypeAsset> assets)
        {
            _assets = assets;
        }

        public IEnumerable<StatTypeAsset> EnumerateStatTypes() => _assets;

        public static StatTypeAsset Build(
            string guid,
            string name,
            bool isAttribute,
            string statDescription,
            string longStatDescription,
            IReadOnlyList<string>? affects = null,
            IReadOnlyList<string>? skillAffects = null) => new(
                Guid: guid,
                AssetName: name,
                IsAttribute: isAttribute,
                StatName: name,
                Icon: null,
                IconColor: new AssetColorSnapshot { R = 1f, G = 1f, B = 1f, A = 1f },
                StatDescription: statDescription,
                LongStatDescription: longStatDescription,
                Affects: affects ?? new List<string>(),
                SkillAffects: skillAffects ?? new List<string>());

        public static StatTypeAsset BuildWithoutGuid(string name) => new(
            Guid: null,
            AssetName: name,
            IsAttribute: false,
            StatName: name,
            Icon: null,
            IconColor: new AssetColorSnapshot(),
            StatDescription: null,
            LongStatDescription: null,
            Affects: new List<string>(),
            SkillAffects: new List<string>());
    }
}
