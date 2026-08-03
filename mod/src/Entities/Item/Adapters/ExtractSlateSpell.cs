using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using UnityEngine;
using ArdenfallStatType = Ardenfall.StatType;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractSlateSpell
{
    public static ItemAdapterResult Extract(SlateSpellItemData asset, RefResolver refs, string rowId)
    {
        var spellData = asset.spellData.Get();
        var spellItemType = asset.spellItemType.Get();
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["quickslotSecondaryColorJson"] = ItemAdapterHelpers.SnapshotColor(asset.quickslotSecondaryColor.Get()),
            ["spellDataJson"] = ItemAdapterHelpers.SnapshotLeveledSpellData(spellData, refs, rowId),
            ["secondarySpellDataJson"] = ItemAdapterHelpers.SnapshotLeveledSpellData(asset.secondarySpellData.Get(), refs, rowId),
            ["spawnWhenSheathed"] = asset.spawnWhenSheathed.Get(),
            ["spellItemType"] = spellItemType.ToString(),
            ["itemTypeTooltip"] = ItemTypeLabel(spellData, spellItemType),
            ["statType"] = RequirementStatTypeLabel(asset.statType.Get(), spellData),
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
        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs), ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }

    public static string? RequirementStatTypeLabel(ArdenfallStatType? equipStatType, LeveledSpellData? spellData) =>
        ExtractEquipment.StatTypeLabel(equipStatType) ?? ExtractEquipment.StatTypeLabel(spellData?.spellData?.statType);

    public static string? ItemTypeLabel(LeveledSpellData? spellData, SpellItemType spellItemType)
    {
        var statName = ExtractEquipment.StatTypeLabel(spellData?.spellData?.statType);
        if (string.IsNullOrWhiteSpace(statName)) return null;
        var typeLabel = spellItemType switch
        {
            SpellItemType.Scroll => "Scroll",
            SpellItemType.Slate => "Slate",
            SpellItemType.Stave => "Stave",
            _ => spellItemType.ToString(),
        };
        return statName + " " + typeLabel;
    }
}
