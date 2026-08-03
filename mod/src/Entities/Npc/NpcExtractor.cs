using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Npc;

public sealed class NpcExtractor : WalkerBase<NpcSnapshotRow>
{
    private readonly INpcRecordSource _source;

    public NpcExtractor()
        : this(new MasterRecordTableNpcRecordSource())
    {
    }

    public NpcExtractor(INpcRecordSource source)
    {
        _source = source;
    }

    public override IEnumerable<NpcSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateNpcs(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "npcRecordMissing",
                Field = "id",
                Message = "NPC record source yielded a null row",
            },
            record =>
            {
                if (string.IsNullOrWhiteSpace(record.Table) ||
                    string.IsNullOrWhiteSpace(record.Subtable) ||
                    string.IsNullOrWhiteSpace(record.Id))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "npcRecordIdMissing",
                        Field = "id",
                        Message = "NPCRecord has no complete RecordID",
                    });
                }

                var rowId = $"{record.Table};{record.Subtable};{record.Id}";
                if (record.Position == null)
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "npcSpawnPointMissing",
                        Field = "spawnPoint",
                        Message = $"NPCRecord '{rowId}' has no spawn point",
                    });
                }
                return ExtractorIdentity.Valid(rowId);
            },
            (record, rowId) =>
            {
                var rowDiagnostics = new List<Diagnostic>();
                var friendlyName = NullIfEmpty(record.FriendlyName);
                if (friendlyName == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "npcFriendlyNameMissing",
                        Field = "friendlyName",
                        Message = $"NPCRecord '{rowId}' has no customFriendlyID",
                    });
                }

                if (string.IsNullOrWhiteSpace(record.MapId))
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "npcMapMissing",
                        Field = "mapId",
                        Message = $"NPCRecord '{rowId}' has no spawn point map",
                    });
                }

                return new NpcSnapshotRow
                {
                    Id = rowId,
                    Fields = new NpcSnapshot(
                        Id: rowId,
                        RecordRef: SnapshotRef.Record(record.Table!, record.Subtable!, record.Id!, "NPCRecord"),
                        FriendlyName: friendlyName,
                        Position: record.Position!,
                        MapId: NullIfEmpty(record.MapId),
                        ContainingLocationRefs: record.ContainingLocationRefs),
                    Diagnostics = rowDiagnostics,
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
