using System;
using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>An enchantment an authored placement carries, with the level it was authored at.</summary>
public sealed class PlacedEnchantment
{
    [JsonProperty("enchantmentRef")] public SnapshotRef EnchantmentRef { get; set; } = null!;

    [JsonProperty("level")] public float Level { get; set; }

    [JsonProperty("hidden")] public bool Hidden { get; set; }
}

/// <summary>Faction and character owners an authored object declares.</summary>
public sealed class PlacedOwners
{
    [JsonProperty("factionRefs")] public List<SnapshotRef> FactionRefs { get; set; } = new();

    [JsonProperty("characterRefs")] public List<SnapshotRef> CharacterRefs { get; set; } = new();
}

/// <summary>One item the world places, as authored.</summary>
public sealed class PlacedItemFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    [JsonProperty("cell")] public string Cell { get; set; } = "";

    [JsonProperty("map")] public string? Map { get; set; }

    [JsonProperty("position")] public ScenePosition Position { get; set; } = new();

    [JsonProperty("itemRef")] public SnapshotRef ItemRef { get; set; } = null!;

    [JsonProperty("stackCount")] public int StackCount { get; set; }

    /// <summary>Authored durability, from 0 through 1.</summary>
    [JsonProperty("durability")] public float Durability { get; set; }

    [JsonProperty("durabilityRuined")] public bool DurabilityRuined { get; set; }

    [JsonProperty("enchantments")] public List<PlacedEnchantment> Enchantments { get; set; } = new();

    [JsonProperty("owners")] public PlacedOwners Owners { get; set; } = new();
}

/// <summary>
/// Publishes `ItemSpawner`: where a copy of an item lies in the world, and how it was authored.
/// </summary>
/// <remarks>
/// A spawner is a world object that references an item, not a property of the item: 553 spawners
/// over 1,273 items is many to many, and the authored modifiers belong to the copy rather than to
/// the item everyone else shares.
/// </remarks>
public sealed class PlacedItemFamily : ISceneFamily
{
    public string EntityId => "placed-item";

    public IEnumerable<Type> ComponentTypes => new[] { typeof(ItemSpawner) };

    public void Harvest(CellScene cell, string? map, CellHarvest harvest)
    {
        var spawners = SceneObjects.InCell<ItemSpawner>(cell);
        harvest.ObjectsSeen += spawners.Count;
        var rows = harvest.RowsFor(EntityId);

        foreach (var spawner in spawners)
        {
            var guid = SceneObjects.GuidOf(spawner);
            if (guid == null)
            {
                harvest.Diagnostics.Add(SceneObjects.MissingGuid(nameof(ItemSpawner), cell.Name));
                continue;
            }

            var position = spawner.transform.position;
            var id = SceneObjects.SceneObjectId(cell.Name, guid);
            rows.Add(new SceneRow(id, new PlacedItemFields
            {
                Id = id,
                Cell = cell.Name,
                Map = map,
                Position = new ScenePosition(position.x, position.y, position.z),
                ItemRef = SceneObjects.AssetRef(spawner.itemData, "ItemSpawner.itemData")
                    ?? SnapshotRef.Missing("placedItemMissing", "ItemSpawner.itemData"),
                StackCount = spawner.stackCount,
                Durability = spawner.durability,
                DurabilityRuined = spawner.durabilityRuined,
                Enchantments = Enchantments(spawner),
                Owners = SceneOwners.Read(spawner.owner),
            }));
        }
    }

    private static List<PlacedEnchantment> Enchantments(ItemSpawner spawner)
    {
        var enchantments = new List<PlacedEnchantment>();
        if (spawner.enchantments == null) return enchantments;
        foreach (var authored in spawner.enchantments)
        {
            if (authored == null) continue;
            enchantments.Add(new PlacedEnchantment
            {
                EnchantmentRef =
                    SceneObjects.AssetRef(authored.enchantment, "ItemSpawner.enchantments")
                    ?? SnapshotRef.Missing("enchantmentMissing", "ItemSpawner.enchantments"),
                Level = authored.level,
                Hidden = authored.hidden,
            });
        }

        return enchantments;
    }
}
