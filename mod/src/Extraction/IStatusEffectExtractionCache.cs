using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatusEffect;

namespace ArdenfallCompendium.Extraction;

public interface IStatusEffectExtractionCache : IExtractionCache
{
    IReadOnlyList<StatusEffectSnapshotRow> GetOrExtract(CompendiumRun run);

    IconAssetPlan GetAssetPlan(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
