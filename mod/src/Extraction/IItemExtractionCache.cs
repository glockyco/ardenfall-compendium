using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;

namespace ArdenfallCompendium.Extraction;

public interface IItemExtractionCache
{
    IReadOnlyList<ItemSnapshotRow> GetOrExtract(CompendiumRun run);

    ItemIconAssetPlan GetAssetPlan(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
