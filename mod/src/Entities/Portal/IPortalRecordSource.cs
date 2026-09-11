using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Portal;

public sealed record PortalRecordSourceRow(
    string? Id,
    string? FriendlyName,
    string? MapId,
    PortalVector3Snapshot? Position,
    SnapshotRef? ConnectedPortalRef,
    bool ConnectedPortalResolved)
{
    public static PortalRecordSourceRow Build(
        string? id,
        string? friendlyName,
        string? mapId,
        PortalVector3Snapshot? position,
        SnapshotRef? connectedPortalRef = null,
        bool connectedPortalResolved = false) =>
        new(id, friendlyName, mapId, position, connectedPortalRef, connectedPortalResolved);
}

public interface IPortalRecordSource
{
    IEnumerable<PortalRecordSourceRow> EnumeratePortals();
}
