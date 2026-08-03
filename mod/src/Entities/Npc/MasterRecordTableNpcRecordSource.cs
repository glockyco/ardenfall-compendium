using System;
using System.Collections.Generic;
using System.Reflection;
using Ardenfall;
using Ardenfall.Item;
using Ardenfall.RecordSystem;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Npc;

public sealed class MasterRecordTableNpcRecordSource : INpcRecordSource
{
    private static FieldInfo? _spawnPointField;
    private readonly Func<IEnumerable<NPCRecord>> _lookupNpcs;
    private readonly Func<IEnumerable<LocationAsset>> _lookupLocations;

    public MasterRecordTableNpcRecordSource()
        : this(
            lookupNpcs: () => ArdenfallGame.instance.worldData.masterRecordTable.GetRecords<NPCRecord>(),
            lookupLocations: () => BuiltLookupTable.GetAssetsOfType<LocationAsset>())
    {
    }

    public MasterRecordTableNpcRecordSource(
        Func<IEnumerable<NPCRecord>> lookupNpcs,
        Func<IEnumerable<LocationAsset>> lookupLocations)
    {
        _lookupNpcs = lookupNpcs;
        _lookupLocations = lookupLocations;
    }

    public IEnumerable<NpcRecordSourceRow> EnumerateNpcs()
    {
        foreach (var record in _lookupNpcs())
        {
            if (record == null)
            {
                yield return null!;
                continue;
            }
            yield return ToRow(record, _lookupLocations());
        }
    }

    private static NpcRecordSourceRow ToRow(
        NPCRecord record,
        IEnumerable<LocationAsset> locations)
    {
        var id = record.id;
        var friendlyName = record.customFriendlyID;
        var spawnPoint = ReadSpawnPoint(record);
        if (spawnPoint == null)
        {
            return new NpcRecordSourceRow(
                Table: id.table,
                Subtable: id.subtable,
                Id: id.id,
                FriendlyName: friendlyName,
                MapId: null,
                Position: null,
                ContainingLocationRefs: new List<SnapshotRef>());
        }

        var containingLocations = new List<SnapshotRef>();

        foreach (var location in locations)
        {
            if (location == null || !location.enabled) continue;
            if (!location.IsInside(spawnPoint.Value.position, spawnPoint.Value.map)) continue;
            containingLocations.Add(ToAssetRef(location, "NPCRecord.containingLocations"));
        }

        return new NpcRecordSourceRow(
            Table: id.table,
            Subtable: id.subtable,
            Id: id.id,
            FriendlyName: friendlyName,
            MapId: spawnPoint.Value.map?.id,
            Position: new NpcVector3Snapshot(
                spawnPoint.Value.position.x,
                spawnPoint.Value.position.y,
                spawnPoint.Value.position.z),
            ContainingLocationRefs: containingLocations);
    }

    private static WorldPosition? ReadSpawnPoint(NPCRecord record)
    {
        var field = _spawnPointField ??= typeof(NPCRecord).GetField(
            "spawnPoint",
            BindingFlags.Instance | BindingFlags.NonPublic) ?? throw new MissingFieldException(
                typeof(NPCRecord).FullName,
                "spawnPoint");
        var stored = (WorldPosition)field.GetValue(record)!;
        if (!stored.IsNull) return stored;

        var transform = record.transform;
        return transform == null
            ? null
            : new WorldPosition(transform.position, transform.GetMapData());
    }

    private static SnapshotRef ToAssetRef(UnityEngine.Object asset, string source)
    {
        var guid = BuiltLookupTable.Instance?.GetGuid(asset);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, asset.name);
    }
}
