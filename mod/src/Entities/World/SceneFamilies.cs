using System;
using System.Collections.Generic;

namespace ArdenfallCompendium.Entities.World;

/// <summary>
/// The families the cell walk publishes, and the snapshot file each one writes.
/// </summary>
/// <remarks>
/// Finalization reads the walk's chunks without loading Unity, so it needs the ids and file names
/// without constructing the families themselves.
/// </remarks>
public static class SceneFamilies
{
    private static readonly Dictionary<string, string> FileByEntityId = new(StringComparer.Ordinal)
    {
        ["placed-plant"] = "placed-plants.json",
        ["placed-item"] = "placed-items.json",
        ["placed-container"] = "placed-containers.json",
        ["world-spawn"] = "world-spawns.json",
    };

    public static IEnumerable<string> EntityIds => FileByEntityId.Keys;

    public static string SnapshotFile(string entityId) => FileByEntityId[entityId];
}
