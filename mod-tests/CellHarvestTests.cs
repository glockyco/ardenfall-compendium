using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.World;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class CellHarvestTests
{
    [Fact]
    public void GroupsRowsByEntityAcrossTheCellsOfABatch()
    {
        var batch = new CellWalkBatch();
        var first = new CellHarvest("cell_a");
        first.RowsFor("placed-plant").Add(Row("plant-1"));
        first.RowsFor("placed-item").Add(Row("item-1"));
        var second = new CellHarvest("cell_b");
        second.RowsFor("placed-item").Add(Row("item-2"));
        batch.Cells.Add(first);
        batch.Cells.Add(second);

        var byEntity = batch.RowsByEntity();

        Assert.Equal(new[] { "plant-1" }, byEntity["placed-plant"].Select(row => row.Id));
        Assert.Equal(new[] { "item-1", "item-2" }, byEntity["placed-item"].Select(row => row.Id));
        Assert.Equal(2, first.RowCount);
    }

    [Fact]
    public void KeepsTheFirstOfTwoObjectsThatShareOneId()
    {
        // The live overworld holds two spawners with one authored guid in one cell. A second row
        // with the same id fails the canonical primary key and takes the whole snapshot with it.
        var harvest = new CellHarvest("cell_overworld_-4.-7");
        harvest.RowsFor("world-spawn").Add(Row("scene;cell_overworld_-4.-7;guid-1"));
        harvest.RowsFor("world-spawn").Add(Row("scene;cell_overworld_-4.-7;guid-1"));
        harvest.RowsFor("world-spawn").Add(Row("scene;cell_overworld_-4.-7;guid-2"));
        harvest.RowsFor("placed-item").Add(Row("scene;cell_overworld_-4.-7;guid-1"));

        harvest.DropDuplicateIds();

        Assert.Equal(
            new[] { "scene;cell_overworld_-4.-7;guid-1", "scene;cell_overworld_-4.-7;guid-2" },
            harvest.RowsFor("world-spawn").Select(row => row.Id));
        Assert.Single(harvest.RowsFor("placed-item"));
        var diagnostic = Assert.Single(harvest.Diagnostics);
        Assert.Equal("sceneObjectIdDuplicate", diagnostic.Code);
        Assert.Contains("world-spawn", diagnostic.Message);
        Assert.Contains("guid-1", diagnostic.Message);
    }

    [Fact]
    public void WritesRowsAsIdAndFields()
    {
        // The pipeline reads every entity envelope as { id, fields }. A flat row passed the
        // synthetic fixture, which was hand-written in the right shape, and failed the live export.
        var envelope = new SceneSnapshotEnvelope(
            "placed-plant",
            new List<SceneRow>
            {
                new(
                    "scene;cell_a;guid-1",
                    new PlacedPlantFields
                    {
                        Id = "scene;cell_a;guid-1",
                        Cell = "cell_a",
                        HarvestXp = 10,
                    }),
            });

        var json = JObject.Parse(JsonConvert.SerializeObject(envelope, JsonSettings.Default));

        Assert.Equal("placed-plant", json["entityId"]?.Value<string>());
        var row = json["rows"]?[0];
        Assert.Equal("scene;cell_a;guid-1", row?["id"]?.Value<string>());
        Assert.Equal("cell_a", row?["fields"]?["cell"]?.Value<string>());
        Assert.Equal(10, row?["fields"]?["harvestXp"]?.Value<int>());
    }

    [Fact]
    public void NamesOneSnapshotFilePerPublishedFamily()
    {
        Assert.Equal(
            new[] { "placed-plant", "placed-item", "placed-container", "world-spawn", "scene-dialogue", "dialogue" },
            SceneFamilies.EntityIds.ToArray());
        Assert.Equal("placed-plants.json", SceneFamilies.SnapshotFile("placed-plant"));
        Assert.Equal("placed-items.json", SceneFamilies.SnapshotFile("placed-item"));
        Assert.Equal("placed-containers.json", SceneFamilies.SnapshotFile("placed-container"));
        Assert.Equal("world-spawns.json", SceneFamilies.SnapshotFile("world-spawn"));
        Assert.Equal("scene-dialogue.json", SceneFamilies.SnapshotFile("scene-dialogue"));
        Assert.Equal("dialogues.json", SceneFamilies.SnapshotFile("dialogue"));
    }

    private static SceneRow Row(string id) => new(id, new PlacedPlantFields { Id = id });
}
