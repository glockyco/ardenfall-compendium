using System;
using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.World;

/// <summary>One cell scene the walk can load.</summary>
public sealed class CellScene
{
    public CellScene(int buildIndex, string name, string path)
    {
        BuildIndex = buildIndex;
        Name = name;
        Path = path;
    }

    public int BuildIndex { get; }

    public string Name { get; }

    public string Path { get; }
}

/// <summary>The build's scene table, so a plan can be computed without an engine.</summary>
public interface ISceneTable
{
    int SceneCountInBuildSettings { get; }

    string GetScenePathByBuildIndex(int buildIndex);

    bool CanStreamedLevelBeLoaded(int buildIndex);
}

/// <summary>Result of planning a walk over the build's cell scenes.</summary>
public sealed class CellScenePlan
{
    public CellScenePlan(IReadOnlyList<CellScene> cells, int scenesInBuild, int unloadable)
    {
        Cells = cells;
        ScenesInBuild = scenesInBuild;
        Unloadable = unloadable;
    }

    public IReadOnlyList<CellScene> Cells { get; }

    public int ScenesInBuild { get; }

    /// <summary>Cell scenes the engine reports it cannot stream, which the walk skips.</summary>
    public int Unloadable { get; }
}

/// <summary>
/// Lists the cell scenes present in build settings.
/// </summary>
/// <remarks>
/// The authoritative list is the build's scene table, not the <c>CellData</c> assets. The Demo
/// carries 607 cell assets and 27 cell scenes, so enumerating assets would ask the engine for
/// hundreds of scenes that do not exist and read their absence as failures.
/// </remarks>
public static class CellSceneInventory
{
    private const string CellScenePrefix = "cell_";

    public static CellScenePlan Plan(ISceneTable table)
    {
        if (table is null) throw new ArgumentNullException(nameof(table));

        var cells = new List<CellScene>();
        var unloadable = 0;
        var count = table.SceneCountInBuildSettings;
        for (var buildIndex = 0; buildIndex < count; buildIndex++)
        {
            var path = table.GetScenePathByBuildIndex(buildIndex);
            if (string.IsNullOrEmpty(path)) continue;
            var name = SceneName(path);
            if (!name.StartsWith(CellScenePrefix, StringComparison.Ordinal)) continue;
            if (!table.CanStreamedLevelBeLoaded(buildIndex))
            {
                unloadable++;
                continue;
            }

            cells.Add(new CellScene(buildIndex, name, path));
        }

        return new CellScenePlan(cells, count, unloadable);
    }

    public static string SceneName(string scenePath)
    {
        if (string.IsNullOrEmpty(scenePath)) return string.Empty;
        var lastSlash = scenePath.LastIndexOf('/');
        var name = lastSlash < 0 ? scenePath : scenePath.Substring(lastSlash + 1);
        return name.EndsWith(".unity", StringComparison.Ordinal)
            ? name.Substring(0, name.Length - ".unity".Length)
            : name;
    }
}

/// <summary>The running build's scene table.</summary>
public sealed class UnitySceneTable : ISceneTable
{
    public int SceneCountInBuildSettings => UnityEngine.SceneManagement.SceneManager.sceneCountInBuildSettings;

    public string GetScenePathByBuildIndex(int buildIndex) =>
        UnityEngine.SceneManagement.SceneUtility.GetScenePathByBuildIndex(buildIndex);

    public bool CanStreamedLevelBeLoaded(int buildIndex) =>
        UnityEngine.Application.CanStreamedLevelBeLoaded(buildIndex);
}
