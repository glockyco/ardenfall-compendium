using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Portal;

namespace ArdenfallCompendium.Extraction;

public sealed class PortalExtractionService : IPortalExtractionCache
{
    private readonly IPortalRecordSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public PortalExtractionService(IPortalRecordSource source)
    {
        _source = source;
    }

    public IReadOnlyList<PortalSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public void Evict(CompendiumRun run) => _byRun.Remove(run.RunId);

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var extractor = new PortalExtractor(_source);
        var rows = new List<PortalSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<PortalSnapshotRow> Rows,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
