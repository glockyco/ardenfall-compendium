using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Npc;

public sealed record NpcRecordSourceRow(
    string? Table,
    string? Subtable,
    string? Id,
    string? FriendlyName,
    string? MapId,
    NpcVector3Snapshot? Position,
    IReadOnlyList<SnapshotRef> ContainingLocationRefs)
{
    public static NpcRecordSourceRow Build(
        string? table,
        string? subtable,
        string? id,
        string? friendlyName,
        string? mapId,
        NpcVector3Snapshot? position,
        IReadOnlyList<SnapshotRef>? containingLocationRefs = null) =>
        new(table, subtable, id, friendlyName, mapId, position,
            containingLocationRefs ?? new List<SnapshotRef>());
}

public interface INpcRecordSource
{
    IEnumerable<NpcRecordSourceRow> EnumerateNpcs();
}
