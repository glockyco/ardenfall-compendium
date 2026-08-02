using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.ItemCategory;

namespace ArdenfallCompendium.Extraction;

public interface IItemCategoryExtractionCache : IExtractionCache
{
    IReadOnlyList<ItemCategorySnapshotRow> GetOrExtract(CompendiumRun run);

    ItemIconAssetPlan GetAssetPlan(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
