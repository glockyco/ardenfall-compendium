using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item.Adapters;

public static class ExtractRepairKit
{
    public static ItemAdapterResult Extract(RepairKitItemData asset, RefResolver refs)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);

        var repairAddAmount = asset.repairAddAmount.Get();
        var repairAddAmountIsSet = asset.repairAddAmount.IsSet;
        fields["repairAddAmount"] = repairAddAmount;
        provenance["repairAddAmount"] = ProvenanceCapture.ForParameter<int>("repairAddAmount.Get()", repairAddAmountIsSet, inherited: !repairAddAmountIsSet);

        var repairPercentageAmount = asset.repairPercentageAmount.Get();
        var repairPercentageAmountIsSet = asset.repairPercentageAmount.IsSet;
        fields["repairPercentageAmount"] = repairPercentageAmount;
        provenance["repairPercentageAmount"] = ProvenanceCapture.ForParameter<float>("repairPercentageAmount.Get()", repairPercentageAmountIsSet, inherited: !repairPercentageAmountIsSet);

        var repairSkillAddAmount = asset.repairSkillAddAmount.Get();
        var repairSkillAddAmountIsSet = asset.repairSkillAddAmount.IsSet;
        fields["repairSkillAddAmount"] = repairSkillAddAmount;
        provenance["repairSkillAddAmount"] = ProvenanceCapture.ForParameter<float>("repairSkillAddAmount.Get()", repairSkillAddAmountIsSet, inherited: !repairSkillAddAmountIsSet);

        var repairSkillMultAmount = asset.repairSkillMultAmount.Get();
        var repairSkillMultAmountIsSet = asset.repairSkillMultAmount.IsSet;
        fields["repairSkillMultAmount"] = repairSkillMultAmount;
        provenance["repairSkillMultAmount"] = ProvenanceCapture.ForParameter<float>("repairSkillMultAmount.Get()", repairSkillMultAmountIsSet, inherited: !repairSkillMultAmountIsSet);

        return new ItemAdapterResult(fields, provenance, ItemAdapterHelpers.DrainDiagnostics(refs), ItemAdapterHelpers.EmptyPresentationOnlyFields());
    }
}
