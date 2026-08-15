using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Npc;

namespace ArdenfallCompendium.Extraction;

public sealed class NpcExtractionService : INpcExtractionCache
{
    private readonly INpcRecordSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public NpcExtractionService(INpcRecordSource source)
    {
        _source = source;
    }

    public int FilteredRuntimeCreatedCount => _source.FilteredRuntimeCreatedCount;

    public IReadOnlyList<NpcSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public void Evict(CompendiumRun run) => _byRun.Remove(run.RunId);

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var extractor = new NpcExtractor(_source);
        var rows = new List<NpcSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<NpcSnapshotRow> Rows,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
