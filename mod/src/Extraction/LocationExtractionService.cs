using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Location;

namespace ArdenfallCompendium.Extraction;

public sealed class LocationExtractionService : ILocationExtractionCache
{
    private readonly ILocationAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public LocationExtractionService(ILocationAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<LocationSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var extractor = new LocationExtractor(_source);
        var rows = new List<LocationSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<LocationSnapshotRow> Rows,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
