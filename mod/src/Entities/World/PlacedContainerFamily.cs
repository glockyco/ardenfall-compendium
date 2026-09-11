using System;
using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>A loot list a container draws from, with how many times it is drawn.</summary>
public sealed class PlacedLootList
{
    [JsonProperty("listRef")] public SnapshotRef ListRef { get; set; } = null!;

    [JsonProperty("count")] public int Count { get; set; }
}

/// <summary>An item a container holds outright, beside its lists.</summary>
public sealed class PlacedCountedItem
{
    [JsonProperty("itemRef")] public SnapshotRef ItemRef { get; set; } = null!;

    [JsonProperty("count")] public int Count { get; set; }
}

/// <summary>How a container is locked, as authored.</summary>
public sealed class PlacedLock
{
    /// <summary>Authored lock mode, such as `Unlocked` or `FullyLocked`.</summary>
    [JsonProperty("mode")] public string Mode { get; set; } = "";

    [JsonProperty("level")] public string Level { get; set; } = "";

    [JsonProperty("allowLockpick")] public bool AllowLockpick { get; set; }

    [JsonProperty("allowDestroy")] public bool AllowDestroy { get; set; }

    /// <summary>Items that open this lock.</summary>
    [JsonProperty("keyRefs")] public List<SnapshotRef> KeyRefs { get; set; } = new();
}

/// <summary>An authored level, which the game either derives or fixes.</summary>
public sealed class PlacedLevel
{
    [JsonProperty("automatic")] public bool Automatic { get; set; }

    [JsonProperty("value")] public int Value { get; set; }

    [JsonProperty("addValue")] public int AddValue { get; set; }
}

/// <summary>One container the world places, as authored.</summary>
public sealed class PlacedContainerFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    [JsonProperty("cell")] public string Cell { get; set; } = "";

    [JsonProperty("map")] public string? Map { get; set; }

    [JsonProperty("position")] public ScenePosition Position { get; set; } = new();

    /// <summary>The name a player reads on the container.</summary>
    [JsonProperty("containerName")] public string ContainerName { get; set; } = "";

    [JsonProperty("interactionText")] public string InteractionText { get; set; } = "";

    [JsonProperty("lootLists")] public List<PlacedLootList> LootLists { get; set; } = new();

    [JsonProperty("additionalItems")] public List<PlacedCountedItem> AdditionalItems { get; set; } = new();

    /// <summary>
    /// Every distinct item the authored lists can yield, flattened without rolling weights.
    /// </summary>
    [JsonProperty("possibleItemRefs")] public List<SnapshotRef> PossibleItemRefs { get; set; } = new();

    [JsonProperty("level")] public PlacedLevel Level { get; set; } = new();

    [JsonProperty("lock")] public PlacedLock Lock { get; set; } = new();

    [JsonProperty("owners")] public PlacedOwners Owners { get; set; } = new();
}

/// <summary>
/// Publishes `StaticContainer`: what a container holds, what opens it, and who owns it.
/// </summary>
/// <remarks>
/// A container is its own entity rather than a field on an item: it carries a player-visible name,
/// a lock, an owner and a loot list, none of which belong to any item inside it. What a container
/// yields on a given playthrough is a runtime roll and is not extracted; the authored lists are.
/// </remarks>
public sealed class PlacedContainerFamily : ISceneFamily
{
    public string EntityId => "placed-container";

    public IEnumerable<Type> ComponentTypes => new[] { typeof(Container) };

    public void Harvest(CellScene cell, string? map, CellHarvest harvest)
    {
        var containers = SceneObjects.InCell<StaticContainer>(cell);
        harvest.ObjectsSeen += containers.Count;
        var rows = harvest.RowsFor(EntityId);

        foreach (var container in containers)
        {
            var guid = SceneObjects.GuidOf(container);
            if (guid == null)
            {
                harvest.Diagnostics.Add(
                    SceneObjects.MissingGuid(nameof(StaticContainer), cell.Name));
                continue;
            }

            var position = container.transform.position;
            var id = SceneObjects.SceneObjectId(cell.Name, guid);
            rows.Add(new SceneRow(id, new PlacedContainerFields
            {
                Id = id,
                Cell = cell.Name,
                Map = map,
                Position = new ScenePosition(position.x, position.y, position.z),
                ContainerName = container.containerName ?? "",
                InteractionText = container.openName ?? "",
                LootLists = LootLists(container),
                PossibleItemRefs = PossibleItems(container),
                AdditionalItems = AdditionalItems(container),
                Level = Level(container.level),
                Lock = Lock(container.containerLock),
                Owners = SceneOwners.Read(container.owner),
            }));
        }
    }

    private static List<PlacedLootList> LootLists(Container container)
    {
        var lists = new List<PlacedLootList>();
        if (container.itemLists == null) return lists;
        foreach (var counted in container.itemLists)
        {
            if (counted?.list == null) continue;
            var reference = SceneObjects.AssetRef(counted.list, "Container.itemLists");
            if (reference == null) continue;
            lists.Add(new PlacedLootList { ListRef = reference, Count = counted.count });
        }

        return lists;
    }

    /// <summary>
    /// What the container's lists can yield. A playthrough rolls one outcome; the authored
    /// structure is the set, and it reuses the traversal every other list consumer uses.
    /// </summary>
    private static List<SnapshotRef> PossibleItems(Container container)
    {
        var refs = new List<SnapshotRef>();
        foreach (var item in ItemLists.Flatten(container.itemLists))
        {
            var reference = SceneObjects.AssetRef(item, "Container.itemLists");
            if (reference != null) refs.Add(reference);
        }

        return refs;
    }

    private static List<PlacedCountedItem> AdditionalItems(Container container)
    {
        var items = new List<PlacedCountedItem>();
        if (container.additionalItems == null) return items;
        foreach (var counted in container.additionalItems)
        {
            if (counted?.item == null) continue;
            var reference = SceneObjects.AssetRef(counted.item, "Container.additionalItems");
            if (reference == null) continue;
            items.Add(new PlacedCountedItem { ItemRef = reference, Count = counted.count });
        }

        return items;
    }

    private static PlacedLevel Level(LevelValue? level) => level == null
        ? new PlacedLevel()
        : new PlacedLevel
        {
            Automatic = level.automatic,
            Value = level.value,
            AddValue = level.addValue,
        };

    private static PlacedLock Lock(global::Ardenfall.Lock? authored)
    {
        var placed = new PlacedLock();
        if (authored == null) return placed;
        placed.Mode = authored.locked.ToString();
        placed.Level = authored.lockLevel.ToString();
        placed.AllowLockpick = authored.allowLockpick;
        placed.AllowDestroy = authored.allowDestroy;
        foreach (var key in authored.keys ?? new List<Ardenfall.Item.ItemData>())
        {
            var reference = SceneObjects.AssetRef(key, "Lock.keys");
            if (reference != null) placed.KeyRefs.Add(reference);
        }

        return placed;
    }
}
