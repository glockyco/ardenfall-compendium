using System;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.World;

/// <summary>
/// One pickable plant as read from a loaded scene, before it becomes a row.
/// </summary>
/// <remarks>
/// Plain data rather than the component, so the mapping is testable without an engine. The Unity
/// side owns reading components; this side owns identity, diagnostics and shape.
/// </remarks>
public sealed class PickablePlantSource
{
    public string? Guid { get; set; }

    public ScenePosition Position { get; set; } = new();

    public string? Map { get; set; }

    public SnapshotRef? ItemRef { get; set; }

    public int ItemCount { get; set; }

    public int RegrowDays { get; set; }

    public int HarvestXp { get; set; }

    public string InteractionText { get; set; } = "";
}

/// <summary>What one harvested cell produced.</summary>
public sealed class CellHarvest
{
    public CellHarvest(string cell, int objectsSeen)
    {
        Cell = cell;
        ObjectsSeen = objectsSeen;
    }

    public string Cell { get; }

    /// <summary>Components of the harvested types the walk saw, including those it cannot publish.</summary>
    public int ObjectsSeen { get; }

    public List<PlacedPlantFields> Plants { get; } = new();

    public List<Diagnostic> Diagnostics { get; } = new();
}

/// <summary>
/// Turns the pickable plants of one loaded cell into rows.
/// </summary>
/// <remarks>
/// Every value comes from its placement. Two plants of one species can carry different harvest
/// experience, and the Demo's uniformity is a property of that build rather than of the species.
/// </remarks>
public static class PickablePlantHarvester
{
    public static void Harvest(CellHarvest harvest, IEnumerable<PickablePlantSource> plants)
    {
        if (harvest is null) throw new ArgumentNullException(nameof(harvest));

        foreach (var plant in plants ?? Array.Empty<PickablePlantSource>())
        {
            if (plant == null) continue;
            if (string.IsNullOrWhiteSpace(plant.Guid))
            {
                harvest.Diagnostics.Add(new Diagnostic
                {
                    Code = "sceneObjectGuidMissing",
                    Severity = "diagnostic",
                    Message =
                        $"PickablePlant in cell '{harvest.Cell}' carries no GUID and was not published.",
                });
                continue;
            }

            harvest.Plants.Add(new PlacedPlantFields
            {
                Id = SceneObjectId(harvest.Cell, plant.Guid!),
                Cell = harvest.Cell,
                Map = plant.Map,
                Position = plant.Position,
                ItemRef = plant.ItemRef ?? SnapshotRef.Missing("plantItemMissing", "PickablePlant.item"),
                ItemCount = plant.ItemCount,
                RegrowDays = plant.RegrowDays,
                HarvestXp = plant.HarvestXp,
                InteractionText = plant.InteractionText,
            });
        }
    }

    /// <summary>An id that declares the mechanism that produced it, like the record ids do.</summary>
    public static string SceneObjectId(string cell, string guid) => $"scene;{cell};{guid}";
}
