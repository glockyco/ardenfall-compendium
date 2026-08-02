using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Location;

namespace ArdenfallCompendium.Extraction;

public interface ILocationExtractionCache : IExtractionCache
{
    IReadOnlyList<LocationSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
