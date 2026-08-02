using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Entities.Item;
using Ardenfall;
using ArdenfallStatType = Ardenfall.StatType;
using Xunit;
using UnityEngine;

namespace ArdenfallCompendium.Tests;

public sealed class StatTypeExtractorTests
{
    [Fact]
    public void ExtractsEveryStatTypeWithNamedIdAndName()
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
        Assert.Equal("named;stat-type;Strength", rows[0].Id);
        Assert.Equal("Strength", rows[0].Fields.StatName);
        Assert.True(rows[0].Fields.IsAttribute);
        Assert.Contains("melee-damage", rows[0].Fields.Affects);
        Assert.False(rows[1].Fields.IsAttribute);
    }

    [Fact]
    public void EmptyStatNameIsFatal()
    {
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.Build("ignored", " ", isAttribute: false, statDescription: "", longStatDescription: ""),
        });
        var extractor = new StatTypeExtractor(source);

        Assert.Empty(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics, d => d.Code == "namedAssetNameMissing");
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Contains("StatType", diagnostic.Message);
        Assert.Contains("' '", diagnostic.Message);
    }

    [Fact]
    public void DuplicateStatNameIsFatal()
    {
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.Build("one", "Same", isAttribute: false, statDescription: "", longStatDescription: ""),
            FakeStatTypeAssetSource.Build("two", "Same", isAttribute: false, statDescription: "", longStatDescription: ""),
        });
        var extractor = new StatTypeExtractor(source);

        Assert.Single(extractor.Walk().ToList());
        var diagnostic = Assert.Single(extractor.Diagnostics, d => d.Code == "namedAssetNameDuplicate");
        Assert.Equal("fatal", diagnostic.Severity);
        Assert.Contains("StatType", diagnostic.Message);
        Assert.Contains("'Same'", diagnostic.Message);
    }

    [Fact]
    public void LoadedStatSourceOrdersAndDeduplicatesAssets()
    {
        var first = RuntimeStat("one", "Zed", isAttribute: false);
        var second = RuntimeStat("two", "Alpha", isAttribute: false);
        var source = new LoadedStatTypeAssetSource(
            loadedStatTypes: () => new[] { first, second, first },
            isUnityNull: _ => false,
            assetName: asset => ReferenceEquals(asset, first) ? "Zed" : "Alpha",
            isAuthoredAsset: _ => true);

        var firstCall = source.EnumerateStatTypes().Select(asset => asset.AssetName).ToList();
        var secondCall = source.EnumerateStatTypes().Select(asset => asset.AssetName).ToList();

        Assert.Equal(new[] { "Alpha", "Zed" }, firstCall);
        Assert.Equal(firstCall, secondCall);
    }

    [Fact]
    public void CapturesStatIconAssetSlots()
    {
        var icon = (Sprite)RuntimeHelpers.GetUninitializedObject(typeof(Sprite));
        var plan = new ItemIconAssetPlan();
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.Build(
                guid: "stat-strength",
                name: "Strength",
                isAttribute: true,
                statDescription: "Raw power.",
                longStatDescription: "Raw power.",
                icon: icon),
        });
        var extractor = new StatTypeExtractor(source, plan);

        _ = extractor.Walk().ToList();

        var slot = Assert.Single(plan.Slots);
        Assert.Equal("stat-type", slot.EntityId);
        Assert.Equal("named;stat-type;Strength", slot.RowId);
        Assert.Equal("iconRef", slot.Slot);
        Assert.Same(icon, slot.Sprite);
    }

    [Fact]
    public void LoadedSourceDoesNotDiscoverStatsFromMasterData()
    {
        var master = (ArdenfallMasterData)RuntimeHelpers.GetUninitializedObject(typeof(ArdenfallMasterData));
        master.allAttributes = new List<ArdenfallStatType>
        {
            RuntimeStat("attr-strength", "Strength", isAttribute: true),
        };
        master.allSkills = new List<ArdenfallStatType>
        {
            RuntimeStat("skill-heavy-armor", "Heavy Armor", isAttribute: false),
        };
        var source = new LoadedStatTypeAssetSource(
            loadedStatTypes: () => System.Array.Empty<ArdenfallStatType>(),
            isUnityNull: _ => false);

        Assert.Empty(source.EnumerateStatTypes());
    }


    [Fact]
    public void LoadedSourceSkipsUnityNullStatAssets()
    {
        var stat = RuntimeStat("attr-strength", "Strength", isAttribute: true);
        var source = new LoadedStatTypeAssetSource(
            loadedStatTypes: () => new[] { stat },
            isUnityNull: _ => true);

        Assert.Empty(source.EnumerateStatTypes());
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
            IReadOnlyList<string>? skillAffects = null,
            Object? icon = null) => new(
                Guid: guid,
                AssetName: name,
                IsAttribute: isAttribute,
                StatName: name,
                Icon: icon,
                IconColor: new AssetColorSnapshot { R = 1f, G = 1f, B = 1f, A = 1f },
                StatDescription: statDescription,
                LongStatDescription: longStatDescription,
                Affects: affects ?? new List<string>(),
                SkillAffects: skillAffects ?? new List<string>());

    }

    private static ArdenfallStatType RuntimeStat(string id, string name, bool isAttribute)
    {
        var stat = (ArdenfallStatType)RuntimeHelpers.GetUninitializedObject(typeof(ArdenfallStatType));
        stat.id = id;
        stat.statName = name;
        stat.isAttribute = isAttribute;
        stat.affects = new List<string>();
        stat.skillAffects = new List<string>();
        return stat;
    }
}
