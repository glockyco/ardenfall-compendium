using System.Linq;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.World;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class PickablePlantHarvesterTests
{
    [Fact]
    public void ReadsEveryValueFromThePlacement()
    {
        var harvest = new CellHarvest("cell_overworld_-2.-7", objectsSeen: 2);

        PickablePlantHarvester.Harvest(harvest, new[]
        {
            NewSource("guid-1", itemCount: 1, regrowDays: 14, harvestXp: 10, text: "Pick"),
            NewSource("guid-2", itemCount: 2, regrowDays: 0, harvestXp: 0, text: "Gather"),
        });

        Assert.Equal(
            new[] { "scene;cell_overworld_-2.-7;guid-1", "scene;cell_overworld_-2.-7;guid-2" },
            harvest.Plants.Select(plant => plant.Id));
        // Two plants of one species may differ; the row carries the placement's own value.
        Assert.Equal(new[] { 10, 0 }, harvest.Plants.Select(plant => plant.HarvestXp));
        Assert.Equal(new[] { 14, 0 }, harvest.Plants.Select(plant => plant.RegrowDays));
        Assert.Equal(new[] { 1, 2 }, harvest.Plants.Select(plant => plant.ItemCount));
        Assert.Equal(new[] { "Pick", "Gather" }, harvest.Plants.Select(plant => plant.InteractionText));
        Assert.Empty(harvest.Diagnostics);
    }

    [Fact]
    public void DiagnosesAPlacementWithNoGuidInsteadOfInventingOne()
    {
        var harvest = new CellHarvest("cell_interior_4.-2", objectsSeen: 1);

        PickablePlantHarvester.Harvest(harvest, new[]
        {
            NewSource(guid: "", itemCount: 1, regrowDays: 1, harvestXp: 5, text: "Pick"),
        });

        Assert.Empty(harvest.Plants);
        var diagnostic = Assert.Single(harvest.Diagnostics);
        Assert.Equal("sceneObjectGuidMissing", diagnostic.Code);
        Assert.Contains("cell_interior_4.-2", diagnostic.Message);
    }

    [Fact]
    public void PublishesAPlacementWhoseItemDoesNotResolve()
    {
        var harvest = new CellHarvest("cell_overworld_0.-7", objectsSeen: 1);
        var source = NewSource("guid-3", itemCount: 1, regrowDays: 4, harvestXp: 1, text: "Pick");
        source.ItemRef = null;
        source.Position = new ScenePosition(4, 5, 6);

        PickablePlantHarvester.Harvest(harvest, new[] { source });

        var row = Assert.Single(harvest.Plants);
        Assert.Equal("missing", row.ItemRef!.Kind);
        Assert.Equal("plantItemMissing", row.ItemRef.Reason);
        Assert.Equal(4, row.Position.X);
    }

    private static PickablePlantSource NewSource(
        string guid,
        int itemCount,
        int regrowDays,
        int harvestXp,
        string text) => new()
    {
        Guid = guid,
        ItemCount = itemCount,
        RegrowDays = regrowDays,
        HarvestXp = harvestXp,
        InteractionText = text,
        ItemRef = SnapshotRef.LookupAsset("item-guid", "Ardenfall.Item.ItemData", "ingr_test"),
        Position = new ScenePosition(1, 2, 3),
        Map = "overworld",
    };
}
