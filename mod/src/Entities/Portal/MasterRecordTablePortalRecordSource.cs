using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.RecordSystem;
using ArdenfallCompendium.Dtos;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Portal;

public sealed class MasterRecordTablePortalRecordSource : IPortalRecordSource
{
    private readonly Func<IEnumerable<PortalRecord>> _lookupPortals;

    public MasterRecordTablePortalRecordSource()
        : this(() => ArdenfallGame.instance.worldData.masterRecordTable.GetRecords<PortalRecord>())
    {
    }

    public MasterRecordTablePortalRecordSource(Func<IEnumerable<PortalRecord>> lookupPortals)
    {
        _lookupPortals = lookupPortals;
    }

    public IEnumerable<PortalRecordSourceRow> EnumeratePortals()
    {
        foreach (var record in _lookupPortals())
        {
            if (record == null) continue;
            yield return ToRow(record);
        }
    }

    private static PortalRecordSourceRow ToRow(PortalRecord record)
    {
        var id = record.id;
        var transform = record.transform;
        var connected = ConnectedPortalRef(record.connectedPortal, out var connectedResolved);
        return new PortalRecordSourceRow(
            Table: id.table,
            Subtable: id.subtable,
            Id: id.id,
            FriendlyName: record.friendlyName,
            MapId: transform?.mapID,
            Position: transform == null ? null : FromVector3(transform.position),
            ConnectedPortalRef: connected,
            ConnectedPortalResolved: connectedResolved);
    }

    private static SnapshotRef? ConnectedPortalRef(RecordReference? reference, out bool resolved)
    {
        resolved = false;
        if (reference == null) return null;
        var id = reference.RecordID;
        if (id.IsNull()) return null;
        resolved = !reference.IsNull;
        return SnapshotRef.Record(id.table, id.subtable, id.id, "PortalRecord");
    }

    private static PortalVector3Snapshot FromVector3(Vector3 value) => new(value.x, value.y, value.z);
}
