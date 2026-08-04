using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.PotionRecipe;

namespace ArdenfallCompendium.Extraction;

public sealed class PotionRecipeExtractionService : IPotionRecipeExtractionCache
{
    private readonly IPotionRecipeAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public PotionRecipeExtractionService(IPotionRecipeAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<PotionRecipeSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    public void Evict(CompendiumRun run) => _byRun.Remove(run.RunId);

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var extractor = new PotionRecipeExtractor(_source);
        var rows = new List<PotionRecipeSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<PotionRecipeSnapshotRow> Rows,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
