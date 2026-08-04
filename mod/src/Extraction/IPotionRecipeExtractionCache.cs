using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.PotionRecipe;

namespace ArdenfallCompendium.Extraction;

public interface IPotionRecipeExtractionCache : IExtractionCache
{
    IReadOnlyList<PotionRecipeSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
