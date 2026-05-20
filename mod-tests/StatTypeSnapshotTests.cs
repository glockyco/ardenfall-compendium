using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatType;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class StatTypeSnapshotTests
{
    [Fact]
    public void RecordCarriesAllAssetFields()
    {
        var snapshot = new StatTypeSnapshot(
            Id: "stat-strength",
            IsAttribute: true,
            StatName: "Strength",
            IconRef: null,
            IconColor: new AssetColorSnapshot { R = 0.95f, G = 0.45f, B = 0.2f, A = 1f },
            StatDescription: "Raw physical power.",
            LongStatDescription: "Raw physical power. Affects melee damage and carry weight.",
            Affects: new List<string> { "melee-damage" },
            SkillAffects: new List<string> { "heavy-armor", "blade" });

        Assert.Equal("stat-strength", snapshot.Id);
        Assert.True(snapshot.IsAttribute);
        Assert.Equal("Strength", snapshot.StatName);
        Assert.Contains("melee-damage", snapshot.Affects);
        Assert.Equal(0.95f, snapshot.IconColor?.R);
    }
}
