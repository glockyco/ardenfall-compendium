using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Faction;

namespace ArdenfallCompendium.Extraction;

public interface IFactionExtractionCache : IExtractionCache
{
    IReadOnlyList<FactionSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
