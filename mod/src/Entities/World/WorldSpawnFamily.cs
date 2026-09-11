using System;
using System.Collections.Generic;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.World;

/// <summary>One place the world instantiates a character.</summary>
public sealed class WorldSpawnFields
{
    [JsonProperty("id")] public string Id { get; set; } = "";

    [JsonProperty("cell")] public string Cell { get; set; } = "";

    [JsonProperty("map")] public string? Map { get; set; }

    [JsonProperty("position")] public ScenePosition Position { get; set; } = new();

    /// <summary>`local` spawns a definition; `record` instantiates an existing record.</summary>
    [JsonProperty("kind")] public string Kind { get; set; } = "";

    /// <summary>The character definition a local spawner instantiates.</summary>
    [JsonProperty("characterRef")] public SnapshotRef? CharacterRef { get; set; }

    /// <summary>The record a record spawner refers to.</summary>
    [JsonProperty("recordRef")] public SnapshotRef? RecordRef { get; set; }
}

/// <summary>
/// Publishes what the authored scenes instantiate: `LocalNPCSpawner` and `RecordNPCSpawner`.
/// </summary>
/// <remarks>
/// A record that exists at rest does not say a player can meet that character. A spawner does, and
/// it is the scene side of a placement the record table already carries. Both kinds are one family
/// because a reader asks the same question of them.
/// </remarks>
public sealed class WorldSpawnFamily : ISceneFamily
{
    public string EntityId => "world-spawn";

    public IEnumerable<Type> ComponentTypes =>
        new[] { typeof(LocalNPCSpawner), typeof(RecordNPCSpawner) };

    public void Harvest(CellScene cell, string? map, CellHarvest harvest)
    {
        var rows = harvest.RowsFor(EntityId);
        var locals = SceneObjects.InCell<LocalNPCSpawner>(cell);
        var records = SceneObjects.InCell<RecordNPCSpawner>(cell);
        harvest.ObjectsSeen += locals.Count + records.Count;

        foreach (var spawner in locals)
        {
            var guid = SceneObjects.GuidOf(spawner);
            if (guid == null)
            {
                harvest.Diagnostics.Add(
                    SceneObjects.MissingGuid(nameof(LocalNPCSpawner), cell.Name));
                continue;
            }

            var id = SceneObjects.SceneObjectId(cell.Name, guid);
            var position = spawner.transform.position;
            rows.Add(new SceneRow(id, new WorldSpawnFields
            {
                Id = id,
                Cell = cell.Name,
                Map = map,
                Position = new ScenePosition(position.x, position.y, position.z),
                Kind = "local",
                // A character definition is published under its asset name, the way every other
                // reference to one is, rather than under a lookup GUID.
                CharacterRef = spawner.characterDataAsset == null
                    ? SnapshotRef.Missing(
                        "spawnDefinitionMissing",
                        "LocalNPCSpawner.characterDataAsset")
                    : SnapshotRef.NamedAsset("character", spawner.characterDataAsset.name),
            }));
        }

        foreach (var spawner in records)
        {
            var guid = SceneObjects.GuidOf(spawner);
            if (guid == null)
            {
                harvest.Diagnostics.Add(
                    SceneObjects.MissingGuid(nameof(RecordNPCSpawner), cell.Name));
                continue;
            }

            var id = SceneObjects.SceneObjectId(cell.Name, guid);
            var position = spawner.transform.position;
            rows.Add(new SceneRow(id, new WorldSpawnFields
            {
                Id = id,
                Cell = cell.Name,
                Map = map,
                Position = new ScenePosition(position.x, position.y, position.z),
                Kind = "record",
                RecordRef = RecordRef(spawner),
            }));
        }
    }

    private static SnapshotRef RecordRef(RecordNPCSpawner spawner)
    {
        var reference = spawner.recordReference;
        if (reference == null)
        {
            return SnapshotRef.Missing(
                "spawnRecordMissing",
                "RecordNPCSpawner.recordReference");
        }

        var id = reference.RecordID;
        return id.IsNull()
            ? SnapshotRef.Missing("spawnRecordMissing", "RecordNPCSpawner.recordReference")
            : SnapshotRef.Record(id.table, id.subtable, id.id, "CharacterRecord");
    }
}
