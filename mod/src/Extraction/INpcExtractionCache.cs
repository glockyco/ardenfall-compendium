using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Npc;

namespace ArdenfallCompendium.Extraction;

public interface INpcExtractionCache : IExtractionCache
{
    IReadOnlyList<NpcSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
