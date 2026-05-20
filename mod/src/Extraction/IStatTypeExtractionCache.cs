using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Entities.Item;

namespace ArdenfallCompendium.Extraction;

public interface IStatTypeExtractionCache
{
    IReadOnlyList<StatTypeSnapshotRow> GetOrExtract(CompendiumRun run);

    ItemIconAssetPlan GetAssetPlan(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
