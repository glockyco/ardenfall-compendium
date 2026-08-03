using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Faction;

namespace ArdenfallCompendium.Extraction;

public sealed class FactionExtractionService : IFactionExtractionCache
{
    private readonly IFactionAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public FactionExtractionService(IFactionAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<FactionSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public void Evict(CompendiumRun run) => _byRun.Remove(run.RunId);

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var extractor = new FactionExtractor(_source);
        var rows = new List<FactionSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<FactionSnapshotRow> Rows,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
