using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.World;

/// <summary>Shared reads every scene family needs: which objects are in a cell, and their identity.</summary>
public static class SceneObjects
{
    public static List<T> InCell<T>(CellScene cell)
        where T : MonoBehaviour =>
        Object.FindObjectsOfType<T>(includeInactive: true)
            .Where(component => component.gameObject.scene.buildIndex == cell.BuildIndex)
            .ToList();

    /// <summary>
    /// The game's own identity for a scene object, or null when it carries none.
    /// </summary>
    /// <remarks>
    /// A positional or hierarchy-path identity is not a substitute: a designer reordering a scene
    /// would rewrite ids silently between builds.
    /// </remarks>
    public static string? GuidOf(MonoBehaviour component)
    {
        var guid = component.GetComponent<GuidComponent>();
        if (guid == null) return null;
        var value = guid.GuidString;
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>An id that declares the mechanism that produced it, like the record ids do.</summary>
    public static string SceneObjectId(string cell, string guid) => $"scene;{cell};{guid}";

    public static Diagnostic MissingGuid(string componentType, string cell) => new()
    {
        Code = "sceneObjectGuidMissing",
        Severity = "diagnostic",
        Message = $"{componentType} in cell '{cell}' carries no GUID and was not published.",
    };

    /// <summary>A reference to an authored asset, or null when the field itself is empty.</summary>
    public static SnapshotRef? AssetRef(Object? asset, string source)
    {
        if (asset == null) return null;
        var guid = BuiltLookupTable.Instance?.GetGuid(asset);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid!, asset.GetType().FullName, asset.name);
    }
}
