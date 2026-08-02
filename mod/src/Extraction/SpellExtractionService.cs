using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.Spell;

namespace ArdenfallCompendium.Extraction;

public sealed class SpellExtractionService : ISpellExtractionCache
{
    private readonly ISpellAssetSource _source;
    private readonly Dictionary<string, ExtractionState> _byRun = new();

    public SpellExtractionService(ISpellAssetSource source)
    {
        _source = source;
    }

    public IReadOnlyList<SpellSnapshotRow> GetOrExtract(CompendiumRun run) => GetState(run).Rows;

    public void Evict(CompendiumRun run) => _byRun.Remove(run.RunId);

    public ItemIconAssetPlan GetAssetPlan(CompendiumRun run) => GetState(run).AssetPlan;

    public IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run) => GetState(run).WalkerDiagnostics;

    private ExtractionState GetState(CompendiumRun run)
    {
        if (_byRun.TryGetValue(run.RunId, out var state)) return state;

        var assetPlan = new ItemIconAssetPlan();
        var extractor = new SpellExtractor(_source);
        var rows = new List<SpellSnapshotRow>();
        foreach (var row in extractor.Walk()) rows.Add(row);

        state = new ExtractionState(rows, assetPlan, extractor.Diagnostics.AsReadOnly());
        _byRun[run.RunId] = state;
        return state;
    }

    private sealed record ExtractionState(
        IReadOnlyList<SpellSnapshotRow> Rows,
        ItemIconAssetPlan AssetPlan,
        IReadOnlyList<Diagnostic> WalkerDiagnostics);
}
