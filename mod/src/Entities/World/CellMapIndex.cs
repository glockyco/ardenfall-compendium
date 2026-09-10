using System;
using System.Collections.Generic;
using Ardenfall;

namespace ArdenfallCompendium.Entities.World;

/// <summary>
/// Maps a cell scene onto the map that owns it, from the authored map data.
/// </summary>
/// <remarks>
/// The scene name embeds the cell id, but the map a cell belongs to is authored on `MapData`, so
/// the index reads it there rather than parsing a name into two facts.
/// </remarks>
public static class CellMapIndex
{
    private static Dictionary<string, string>? _byCellScene;

    /// <summary>Builds the index from the world's maps. Safe to call once per walk.</summary>
    public static void Build(IEnumerable<KeyValuePair<string, string>> cellIdToMapId)
    {
        var index = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var pair in cellIdToMapId)
        {
            if (string.IsNullOrWhiteSpace(pair.Key)) continue;
            index["cell_" + pair.Key] = pair.Value;
        }

        _byCellScene = index;
    }

    public static void BuildFromWorld()
    {
        var pairs = new List<KeyValuePair<string, string>>();
        var maps = ArdenfallGame.instance?.worldData?.maps;
        if (maps != null)
        {
            foreach (var map in maps)
            {
                if (map == null) continue;
                var cells = map.cells;
                if (cells == null) continue;
                foreach (var cell in cells)
                {
                    if (cell == null || string.IsNullOrWhiteSpace(cell.id)) continue;
                    pairs.Add(new KeyValuePair<string, string>(cell.id, map.id));
                }
            }
        }

        Build(pairs);
    }

    public static string? MapOfCellScene(string cellSceneName)
    {
        if (_byCellScene == null) return null;
        return _byCellScene.TryGetValue(cellSceneName, out var map) ? map : null;
    }
}
