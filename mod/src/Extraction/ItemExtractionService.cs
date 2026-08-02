using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;

namespace ArdenfallCompendium.Extraction;

public sealed class ItemExtractionService : IItemExtractionCache
{
    private readonly IItemAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public ItemExtractionService(IItemAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public void Evict(CompendiumRun run) => _byRun.Remove(run.RunId);

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => GetState(run).AssetPlan;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var assetPlan = new ItemIconAssetPlan();
        var extractor = new ItemExtractor(_source, assetPlan);
        var rows = new List<ItemSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, assetPlan, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<ItemSnapshotRow> Rows,
        ItemIconAssetPlan AssetPlan,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
