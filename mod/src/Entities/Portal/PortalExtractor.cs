using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Portal;

public sealed class PortalExtractor : WalkerBase<PortalSnapshotRow>
{
    private readonly IPortalRecordSource _source;

    public PortalExtractor()
        : this(new MasterRecordTablePortalRecordSource())
    {
    }

    public PortalExtractor(IPortalRecordSource source)
    {
        _source = source;
    }

    public override IEnumerable<PortalSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumeratePortals(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "portalRecordMissing",
                Field = "id",
                Message = "Portal record source yielded a null row",
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
                        Code = "portalRecordIdMissing",
                        Field = "id",
                        Message = "PortalRecord has no complete RecordID",
                    });
                }
                var rowId = $"{record.Table};{record.Subtable};{record.Id}";
                if (record.Position == null)
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "portalTransformMissing",
                        Field = "position",
                        Message = $"PortalRecord '{rowId}' has no transform",
                    });
                }
                return ExtractorIdentity.Valid(rowId);
            },
            (record, rowId) =>
            {
                var rowDiagnostics = new List<Diagnostic>();
                if (string.IsNullOrWhiteSpace(record.MapId))
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "portalMapMissing",
                        Field = "mapId",
                        Message = $"PortalRecord '{rowId}' has no transform mapID",
                    });
                }
                if (record.ConnectedPortalRef == null || !record.ConnectedPortalResolved)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "connectedPortalMissing",
                        Field = "connectedPortalRef",
                        Message = $"PortalRecord '{rowId}' has no resolved connected portal",
                    });
                }
                var name = NullIfEmpty(record.FriendlyName);
                if (name == null)
                {
                    rowDiagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "portalNameMissing",
                        Field = "friendlyName",
                        Message = $"PortalRecord '{rowId}' has no friendlyName",
                    });
                }

                return new PortalSnapshotRow
                {
                    Id = rowId,
                    Fields = new PortalSnapshot(
                        Id: rowId,
                        RecordRef: SnapshotRef.Record(record.Table!, record.Subtable!, record.Id!, "PortalRecord"),
                        Name: name,
                        MapId: NullIfEmpty(record.MapId),
                        Position: record.Position!,
                        ConnectedPortalRef: record.ConnectedPortalRef),
                    Diagnostics = rowDiagnostics,
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
