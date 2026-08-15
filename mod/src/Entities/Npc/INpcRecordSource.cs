using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Npc;

public sealed record NpcRecordSourceRow(
    string? Table,
    string? Subtable,
    string? Id,
    string? DisplayName,
    string DisplayNameProvenance,
    string? DisplayNameOwner,
    string? AuthoringLabel,
    SnapshotRef? CharacterRef,
    string? MapId,
    NpcVector3Snapshot? Position,
    IReadOnlyList<SnapshotRef> ContainingLocationRefs)
{
    public static NpcRecordSourceRow Build(
        string? table,
        string? subtable,
        string? id,
        string? displayName,
        string displayNameProvenance,
        string? displayNameOwner,
        string? authoringLabel,
        SnapshotRef? characterRef,
        string? mapId,
        NpcVector3Snapshot? position,
        IReadOnlyList<SnapshotRef>? containingLocationRefs = null) =>
        new(table, subtable, id, displayName, displayNameProvenance, displayNameOwner,
            authoringLabel, characterRef, mapId, position,
            containingLocationRefs ?? new List<SnapshotRef>());
}

public interface INpcRecordSource
{
    int FilteredRuntimeCreatedCount { get; }

    IEnumerable<NpcRecordSourceRow> EnumerateNpcs();
}
