using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.NameSet;

namespace ArdenfallCompendium.Extraction;

public interface INameSetExtractionCache : IExtractionCache
{
    IReadOnlyList<NameSetSnapshotRow> GetOrExtract(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
