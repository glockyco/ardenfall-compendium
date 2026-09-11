using System;
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.World;

/// <summary>
/// Publishes `PickablePlant`: what one harvest yields, and what it awards.
/// </summary>
/// <remarks>
/// Every value comes from its placement. Two plants of one species can carry different harvest
/// experience, and the Demo's uniformity is a property of that build rather than of the species.
/// </remarks>
public sealed class PickablePlantFamily : ISceneFamily
{
    public string EntityId => "placed-plant";

    public IEnumerable<Type> ComponentTypes => new[] { typeof(PickablePlant) };

    public void Harvest(CellScene cell, string? map, CellHarvest harvest)
    {
        var plants = SceneObjects.InCell<PickablePlant>(cell);
        harvest.ObjectsSeen += plants.Count;
        var rows = harvest.RowsFor(EntityId);

        foreach (var plant in plants)
        {
            var guid = SceneObjects.GuidOf(plant);
            if (guid == null)
            {
                harvest.Diagnostics.Add(SceneObjects.MissingGuid(nameof(PickablePlant), cell.Name));
                continue;
            }

            var position = plant.transform.position;
            var id = SceneObjects.SceneObjectId(cell.Name, guid);
            rows.Add(new SceneRow(id, new PlacedPlantFields
            {
                Id = id,
                Cell = cell.Name,
                Map = map,
                Position = new ScenePosition(position.x, position.y, position.z),
                ItemRef = SceneObjects.AssetRef(plant.item, "PickablePlant.item")
                    ?? SnapshotRef.Missing("plantItemMissing", "PickablePlant.item"),
                ItemCount = plant.itemCount,
                RegrowDays = plant.regrowDays,
                HarvestXp = plant.giveXP,
                InteractionText = plant.pickupText ?? "",
            }));
        }
    }
}
