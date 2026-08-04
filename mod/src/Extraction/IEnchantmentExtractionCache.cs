using System.Collections.Generic;
using ArdenfallCompendium.Control;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Enchantment;

namespace ArdenfallCompendium.Extraction;

public interface IEnchantmentExtractionCache : IExtractionCache
{
    IReadOnlyList<EnchantmentSnapshotRow> GetOrExtract(CompendiumRun run);
    IReadOnlyList<Diagnostic> GetWalkerDiagnostics(CompendiumRun run);
}
