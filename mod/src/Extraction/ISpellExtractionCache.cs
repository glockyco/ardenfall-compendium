using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Spell;

namespace ArdenfallCompendium.Extraction;

public interface ISpellExtractionCache : IExtractionCache
{
    IReadOnlyList<SpellSnapshotRow> GetOrExtract(CompendiumRun run);

    IconAssetPlan GetAssetPlan(CompendiumRun run);

    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
