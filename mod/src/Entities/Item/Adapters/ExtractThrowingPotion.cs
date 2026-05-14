using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractThrowingPotion
{
    public static ItemAdapterResult Extract(ThrowingPotionData asset, RefResolver refs, string rowId)
    {
        var areaOfEffect = asset.areaOfEffect.Get();
        var visualLevel = asset.VisualLevel;
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["quickslotSecondaryColorJson"] = ItemAdapterHelpers.SnapshotColor(asset.quickslotSecondaryColor.Get()),
            ["areaOfEffectRange"] = asset.areaOfEffectRange.Get(),
            ["areaOfEffectJson"] = ItemAdapterHelpers.SnapshotLeveledStatusEffects(areaOfEffect, refs, rowId),
            ["visualLevel"] = visualLevel,
            ["effectName"] = GetEffectNameSafe(areaOfEffect, visualLevel),
            ["isDrinkingPotion"] = asset.isDrinkingPotion.Get(),
        };
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal)
        {
            ["quickslotSecondaryColorJson"] = ProvenanceCapture.ForParameter<Color>("quickslotSecondaryColor.Get()", asset.quickslotSecondaryColor.IsSet, inherited: !asset.quickslotSecondaryColor.IsSet),
            ["areaOfEffectRange"] = ProvenanceCapture.ForParameter<float>("areaOfEffectRange.Get()", asset.areaOfEffectRange.IsSet, inherited: !asset.areaOfEffectRange.IsSet),
            ["areaOfEffectJson"] = ProvenanceCapture.ForParameter<LeveledStatusEffect[]>("areaOfEffect.Get()", asset.areaOfEffect.IsSet, inherited: !asset.areaOfEffect.IsSet),
            ["visualLevel"] = ProvenanceCapture.ForParameter<int>("VisualLevel", asset.visualLevel.IsSet, inherited: !asset.visualLevel.IsSet),
            ["effectName"] = ProvenanceCapture.ForParameter<string>("GetEffectName()", true, inherited: false),
            ["isDrinkingPotion"] = ProvenanceCapture.ForParameter<bool>("isDrinkingPotion.Get()", asset.isDrinkingPotion.IsSet, inherited: !asset.isDrinkingPotion.IsSet),
        };
        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs));
    }

    public static string? GetEffectNameSafe(LeveledStatusEffect[]? areaOfEffect, float visualLevel)
    {
        if (areaOfEffect == null || areaOfEffect.Length == 0 || areaOfEffect[0] == null)
        {
            return null;
        }

        var statusEffect = areaOfEffect[0].StatusEffect;
        if (ReferenceEquals(statusEffect, null))
        {
            return null;
        }

        return statusEffect.statusEffectName + " " + RomanNumerals.ToRoman(visualLevel);
    }
}
