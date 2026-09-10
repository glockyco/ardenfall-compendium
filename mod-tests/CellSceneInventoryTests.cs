using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.World;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class CellSceneInventoryTests
{
    [Fact]
    public void KeepsOnlyCellScenesAndNamesThemWithoutTheirExtension()
    {
        var plan = CellSceneInventory.Plan(new FakeSceneTable(new[]
        {
            "Assets/Game/MainMenu/Boot.unity",
            "Assets/World/Ardenfall/Maps/overworld/map_overworld.unity",
            "Assets/World/Ardenfall/Maps/overworld/Cells/overworld_-2.-7/cell_overworld_-2.-7.unity",
            "Assets/World/Ardenfall/Maps/interior/Cells/interior_4.-2/cell_interior_4.-2.unity",
        }));

        Assert.Equal(
            new[] { "cell_overworld_-2.-7", "cell_interior_4.-2" },
            plan.Cells.Select(cell => cell.Name));
        Assert.Equal(new[] { 2, 3 }, plan.Cells.Select(cell => cell.BuildIndex));
        Assert.Equal(4, plan.ScenesInBuild);
        Assert.Equal(0, plan.Unloadable);
    }

    [Fact]
    public void CountsACellSceneTheEngineCannotStreamInsteadOfPlanningIt()
    {
        var table = new FakeSceneTable(new[]
        {
            "Assets/.../cell_overworld_0.0.unity",
            "Assets/.../cell_overworld_0.1.unity",
        });
        table.Unloadable.Add(1);

        var plan = CellSceneInventory.Plan(table);

        Assert.Equal(new[] { "cell_overworld_0.0" }, plan.Cells.Select(cell => cell.Name));
        Assert.Equal(1, plan.Unloadable);
    }

    [Fact]
    public void PlansTheSameOrderTwice()
    {
        var table = new FakeSceneTable(new[]
        {
            "Assets/.../cell_b.unity",
            "Assets/.../cell_a.unity",
        });

        Assert.Equal(
            CellSceneInventory.Plan(table).Cells.Select(cell => cell.BuildIndex),
            CellSceneInventory.Plan(table).Cells.Select(cell => cell.BuildIndex));
    }

    private sealed class FakeSceneTable : ISceneTable
    {
        private readonly IReadOnlyList<string> _paths;

        public FakeSceneTable(IReadOnlyList<string> paths) => _paths = paths;

        public HashSet<int> Unloadable { get; } = new();

        public int SceneCountInBuildSettings => _paths.Count;

        public string GetScenePathByBuildIndex(int buildIndex) => _paths[buildIndex];

        public bool CanStreamedLevelBeLoaded(int buildIndex) => !Unloadable.Contains(buildIndex);
    }
}
