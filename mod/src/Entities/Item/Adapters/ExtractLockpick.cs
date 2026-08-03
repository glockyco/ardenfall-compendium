using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractLockpick
{
    public static ItemAdapterResult Extract(LockpickItemData asset, RefResolver refs)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);

        var successChance = asset.successChance.Get();
        var successChanceIsSet = asset.successChance.IsSet;
        fields["successChance"] = successChance;
        provenance["successChance"] = ProvenanceCapture.ForParameter<float>("successChance.Get()", successChanceIsSet, inherited: !successChanceIsSet);

        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs), ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }
}
