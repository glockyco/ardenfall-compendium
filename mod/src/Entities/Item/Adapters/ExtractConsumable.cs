using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractConsumable
{
    public static ItemAdapterResult Extract(ConsumableItemData asset, RefResolver refs, string rowId)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);

        var cooldown = asset.quickslotCooldownTime.Get();
        var cooldownIsSet = asset.quickslotCooldownTime.IsSet;
        fields["quickslotCooldownTime"] = cooldown;
        provenance["quickslotCooldownTime"] = ProvenanceCapture.ForParameter<float>("quickslotCooldownTime.Get()", cooldownIsSet, inherited: !cooldownIsSet);

        var statusEffects = asset.statusEffects.Get();
        var statusEffectsIsSet = asset.statusEffects.IsSet;
        fields["statusEffectsJson"] = ItemAdapterHelpers.SnapshotLeveledStatusEffects(statusEffects, refs, rowId);
        provenance["statusEffectsJson"] = ProvenanceCapture.ForParameter<LeveledStatusEffect[]>("statusEffects.Get()", statusEffectsIsSet, inherited: !statusEffectsIsSet);

        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs));
    }
}
