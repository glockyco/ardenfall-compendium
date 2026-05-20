using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.ItemCategory;

namespace ArdenfallCompendium.Extraction;

public sealed class ItemCategoryExtractionService : IItemCategoryExtractionCache
{
    private readonly IItemCategoryAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public ItemCategoryExtractionService(IItemCategoryAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<ItemCategorySnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => GetState(run).AssetPlan;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var assetPlan = new ItemIconAssetPlan();
        var extractor = new ItemCategoryExtractor(_source, assetPlan);
        var rows = new List<ItemCategorySnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, assetPlan, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<ItemCategorySnapshotRow> Rows,
        ItemIconAssetPlan AssetPlan,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
