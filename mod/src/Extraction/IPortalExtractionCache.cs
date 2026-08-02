using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Portal;

namespace ArdenfallCompendium.Extraction;

public interface IPortalExtractionCache : IExtractionCache
{
    IReadOnlyList<PortalSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
