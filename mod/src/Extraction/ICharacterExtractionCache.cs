using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Character;

namespace ArdenfallCompendium.Extraction;

public interface ICharacterExtractionCache : IExtractionCache
{
    IReadOnlyList<CharacterSnapshotRow> GetOrExtract(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
