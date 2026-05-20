using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.StatType;

namespace ArdenfallCompendium.Extraction;

public interface IStatTypeExtractionCache
{
    IReadOnlyList<StatTypeSnapshot> GetOrExtract(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
