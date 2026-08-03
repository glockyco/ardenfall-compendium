using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Quest;

namespace ArdenfallCompendium.Extraction;

public interface IQuestExtractionCache : IExtractionCache
{
    IReadOnlyList<QuestSnapshotRow> GetOrExtract(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
