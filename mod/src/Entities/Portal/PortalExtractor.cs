using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
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
        foreach (var record in _source.EnumeratePortals())
        {
            if (string.IsNullOrWhiteSpace(record.Table) || string.IsNullOrWhiteSpace(record.Subtable) || string.IsNullOrWhiteSpace(record.Id))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "portalRecordIdMissing",
                    Field = "id",
                    Message = "PortalRecord has no complete RecordID",
                });
                continue;
            }
            if (record.Position == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "portalTransformMissing",
                    Field = "position",
                    Message = $"PortalRecord '{record.Table};{record.Subtable};{record.Id}' has no transform",
                });
                continue;
            }

            var rowId = $"{record.Table};{record.Subtable};{record.Id}";
            var diagnostics = new List<Diagnostic>();
            if (string.IsNullOrWhiteSpace(record.MapId))
            {
                diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "portalMapMissing",
                    Field = "mapId",
                    Message = $"PortalRecord '{rowId}' has no transform mapID",
                });
            }
            if (record.ConnectedPortalRef == null || !record.ConnectedPortalResolved)
            {
                diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "connectedPortalMissing",
                    Field = "connectedPortalRef",
                    Message = $"PortalRecord '{rowId}' has no resolved connected portal",
                });
            }

            yield return new PortalSnapshotRow
            {
                Id = rowId,
                Fields = new PortalSnapshot(
                    Id: rowId,
                    RecordRef: SnapshotRef.Record(record.Table, record.Subtable, record.Id, "PortalRecord"),
                    Name: NullIfEmpty(record.FriendlyName) ?? rowId,
                    IsAccessible: record.IsAccessible,
                    MapId: NullIfEmpty(record.MapId),
                    Position: record.Position,
                    ConnectedPortalRef: record.ConnectedPortalRef),
                Diagnostics = diagnostics,
            };
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
