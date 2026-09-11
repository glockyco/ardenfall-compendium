using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>One harvested scene object, in the shape every entity envelope uses.</summary>
public sealed class SceneRow
{
    public SceneRow(string id, object fields)
    {
        Id = id;
        Fields = fields;
    }

    [JsonProperty("id")] public string Id { get; }

    [JsonProperty("fields")] public object Fields { get; }

    [JsonProperty("diagnostics")] public List<Dtos.Diagnostic> Diagnostics { get; } = new();
}

/// <summary>An entity envelope written by the cell walk.</summary>
public sealed class SceneSnapshotEnvelope
{
    public SceneSnapshotEnvelope() { }

    public SceneSnapshotEnvelope(string entityId, List<SceneRow> rows)
    {
        EntityId = entityId;
        Rows = rows;
    }

    [JsonProperty("entityId")] public string EntityId { get; set; } = "";

    [JsonProperty("schemaVersion")] public int SchemaVersion { get; set; } = 1;

    [JsonProperty("rows")] public List<SceneRow> Rows { get; set; } = new();
}

/// <summary>What one cell produced, per family.</summary>
public sealed class CellHarvest
{
    public CellHarvest(string cell) => Cell = cell;

    public string Cell { get; }

    /// <summary>Components of the harvested types the walk saw, including those it cannot publish.</summary>
    public int ObjectsSeen { get; set; }

    /// <summary>Rows by entity id, so a family never has to know about its siblings.</summary>
    public Dictionary<string, List<SceneRow>> Rows { get; } = new(StringComparer.Ordinal);

    public List<Dtos.Diagnostic> Diagnostics { get; } = new();

    public List<SceneRow> RowsFor(string entityId)
    {
        if (!Rows.TryGetValue(entityId, out var rows))
        {
            rows = new List<SceneRow>();
            Rows[entityId] = rows;
        }

        return rows;
    }

    /// <summary>
    /// Keeps the first row of each id in this cell and names the rest.
    /// </summary>
    /// <remarks>
    /// A scene can hold two objects that share one authored guid, which a copied prefab leaves
    /// behind. The row id is the canonical key downstream, so a second row with the same id would
    /// fail the whole snapshot rather than describe one object twice.
    /// </remarks>
    public void DropDuplicateIds()
    {
        foreach (var pair in Rows)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var rows = pair.Value;
            for (var index = 0; index < rows.Count;)
            {
                var row = rows[index];
                if (seen.Add(row.Id))
                {
                    index++;
                    continue;
                }

                Diagnostics.Add(new Dtos.Diagnostic
                {
                    Code = "sceneObjectIdDuplicate",
                    Severity = "diagnostic",
                    Field = "id",
                    Message = $"Cell '{Cell}' holds more than one {pair.Key} object with id '{row.Id}'; only the first is published.",
                });
                rows.RemoveAt(index);
            }
        }
    }

    public int RowCount
    {
        get
        {
            var total = 0;
            foreach (var rows in Rows.Values) total += rows.Count;
            return total;
        }
    }
}

/// <summary>
/// One family of authored scene objects the walk publishes.
/// </summary>
/// <remarks>
/// The walk owns frames, scene loading and the guarantees. A family owns one component type: which
/// objects it reads in a loaded cell, and what a row of it looks like.
/// </remarks>
public interface ISceneFamily
{
    /// <summary>Entity id this family publishes, matching its descriptor.</summary>
    string EntityId { get; }

    /// <summary>Component types this family consumes, so the walk can report the rest.</summary>
    IEnumerable<Type> ComponentTypes { get; }

    void Harvest(CellScene cell, string? map, CellHarvest harvest);
}
