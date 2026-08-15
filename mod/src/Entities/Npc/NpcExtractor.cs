using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Npc;

public sealed class NpcExtractor : WalkerBase<NpcSnapshotRow>
{
    private readonly INpcRecordSource _source;

    public int FilteredRuntimeCreatedCount => _source.FilteredRuntimeCreatedCount;

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
                var displayName = NullIfEmpty(record.DisplayName);
                if (displayName == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "npcDisplayNameMissing",
                        Field = "displayName",
                        Message = $"NPCRecord '{rowId}' resolves no display name",
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
                        DisplayName: displayName,
                        DisplayNameProvenance: record.DisplayNameProvenance,
                        DisplayNameOwner: NullIfEmpty(record.DisplayNameOwner),
                        AuthoringLabel: NullIfEmpty(record.AuthoringLabel),
                        CharacterRef: record.CharacterRef,
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
