using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatType;

namespace ArdenfallCompendium.Extraction;

public interface IStatTypeExtractionCache : IExtractionCache
{
    IReadOnlyList<StatTypeSnapshotRow> GetOrExtract(CompendiumRun run);

    IconAssetPlan GetAssetPlan(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
