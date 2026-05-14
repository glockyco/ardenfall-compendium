using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractSlateSpell
{
    public static ItemAdapterResult Extract(SlateSpellItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["quickslotSecondaryColorJson"] = ItemAdapterHelpers.SnapshotColor(asset.quickslotSecondaryColor.Get()),
            ["spellDataJson"] = ItemAdapterHelpers.SnapshotLeveledSpellData(asset.spellData.Get(), refs, rowId),
            ["secondarySpellDataJson"] = ItemAdapterHelpers.SnapshotLeveledSpellData(asset.secondarySpellData.Get(), refs, rowId),
            ["spawnWhenSheathed"] = asset.spawnWhenSheathed.Get(),
            ["spellItemType"] = asset.spellItemType.Get().ToString(),
            ["durabilityMax"] = asset.durabilityMax.Get(),
            ["manaCostMultiplier"] = asset.manaCostMultiplier.Get(),
        };
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal)
        {
            ["quickslotSecondaryColorJson"] = ProvenanceCapture.ForParameter<Color>("quickslotSecondaryColor.Get()", asset.quickslotSecondaryColor.IsSet, inherited: !asset.quickslotSecondaryColor.IsSet),
            ["spellDataJson"] = ProvenanceCapture.ForParameter<LeveledSpellData>("spellData.Get()", asset.spellData.IsSet, inherited: !asset.spellData.IsSet),
            ["secondarySpellDataJson"] = ProvenanceCapture.ForParameter<LeveledSpellData>("secondarySpellData.Get()", asset.secondarySpellData.IsSet, inherited: !asset.secondarySpellData.IsSet),
            ["spawnWhenSheathed"] = ProvenanceCapture.ForParameter<bool>("spawnWhenSheathed.Get()", asset.spawnWhenSheathed.IsSet, inherited: !asset.spawnWhenSheathed.IsSet),
            ["spellItemType"] = ProvenanceCapture.ForParameter<SpellItemType>("spellItemType.Get()", asset.spellItemType.IsSet, inherited: !asset.spellItemType.IsSet),
            ["durabilityMax"] = ProvenanceCapture.ForParameter<int>("durabilityMax.Get()", asset.durabilityMax.IsSet, inherited: !asset.durabilityMax.IsSet),
            ["manaCostMultiplier"] = ProvenanceCapture.ForParameter<float>("manaCostMultiplier.Get()", asset.manaCostMultiplier.IsSet, inherited: !asset.manaCostMultiplier.IsSet),
        };
        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs));
    }
}
