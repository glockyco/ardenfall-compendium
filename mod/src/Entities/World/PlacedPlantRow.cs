using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>A pickable plant placed in a cell scene.</summary>
public sealed class PlacedPlantFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    [JsonProperty("cell")] public string Cell { get; set; } = "";

    [JsonProperty("map")] public string? Map { get; set; }

    [JsonProperty("position")] public ScenePosition Position { get; set; } = new();

    /// <summary>The item one harvest yields.</summary>
    [JsonProperty("itemRef")] public SnapshotRef? ItemRef { get; set; }

    [JsonProperty("itemCount")] public int ItemCount { get; set; }

    /// <summary>Days until the plant regrows. Zero never regrows.</summary>
    [JsonProperty("regrowDays")] public int RegrowDays { get; set; }

    /// <summary>Experience one harvest awards. Read from this placement, never from its species.</summary>
    [JsonProperty("harvestXp")] public int HarvestXp { get; set; }

    [JsonProperty("interactionText")] public string InteractionText { get; set; } = "";
}

public sealed class ScenePosition
{
    public ScenePosition() { }

    public ScenePosition(float x, float y, float z)
    {
        X = x;
        Y = y;
        Z = z;
    }

    [JsonProperty("x")] public float X { get; set; }

    [JsonProperty("y")] public float Y { get; set; }

    [JsonProperty("z")] public float Z { get; set; }
}
