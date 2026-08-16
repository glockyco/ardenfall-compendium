using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.CharacterRace;

namespace ArdenfallCompendium.Extraction;

public interface ICharacterRaceExtractionCache : IExtractionCache
{
    IReadOnlyList<CharacterRaceSnapshotRow> GetOrExtract(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
