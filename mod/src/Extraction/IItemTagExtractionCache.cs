using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.ItemTag;

namespace ArdenfallCompendium.Extraction;

public interface IItemTagExtractionCache : IExtractionCache
{
    IReadOnlyList<ItemTagSnapshotRow> GetOrExtract(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
