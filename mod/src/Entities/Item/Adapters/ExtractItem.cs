using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Walker;

namespace ArdenfallArchives.Entities.Item.Adapters;

public static class ExtractItem
{
    public static (Dictionary<string, object?> fields, Dictionary<string, Provenance> provenance, List<Diagnostic> diagnostics, List<string> tags)
        Extract(ItemData asset, RefResolver refs, string id)
    {
        var fields = new Dictionary<string, object?>(StringComparer.Ordinal);
        var provenance = new Dictionary<string, Provenance>(StringComparer.Ordinal);
        var diagnostics = new List<Diagnostic>();
        var tags = new List<string>();

        fields["id"] = id;

        var nameResolved = asset.itemName.Get();
        var nameIsSet = asset.itemName.IsSet;
        fields["name"] = nameResolved;
        provenance["name"] = ProvenanceCapture.ForParameter<string>("itemName.Get()", nameIsSet, inherited: !nameIsSet);

        var weightResolved = asset.weight.Get();
        var weightIsSet = asset.weight.IsSet;
        fields["weight"] = weightResolved;
        provenance["weight"] = ProvenanceCapture.ForParameter<float>("weight.Get()", weightIsSet, inherited: !weightIsSet);

        var valueResolved = asset.moneyValue.Get();
        var valueIsSet = asset.moneyValue.IsSet;
        fields["value"] = valueResolved;
        provenance["value"] = ProvenanceCapture.ForParameter<int>("moneyValue.Get()", valueIsSet, inherited: !valueIsSet);

        var descResolved = asset.description?.Get() ?? "";
        var descIsSet = asset.description?.IsSet ?? false;
        fields["description"] = descResolved;
        provenance["description"] = ProvenanceCapture.ForParameter<string>("description.Get()", descIsSet, inherited: !descIsSet);

        fields["iconRef"] = refs.ResolveAsset(asset.icon?.Get(), "iconRef", id, MissingPolicy.Diagnostic, source: "ItemData.icon");
        provenance["iconRef"] = (fields["iconRef"] as SnapshotRef)?.Kind == "missing"
            ? ProvenanceCapture.ForMissing("ItemData.icon", inherited: false)
            : ProvenanceCapture.ForLookupAsset("ItemData.icon", isSet: true, inherited: false);

        var tagListResolved = asset.tags.Get();
        var tagIsSet = asset.tags.IsSet;
        provenance["tags"] = ProvenanceCapture.ForSmartList<object>("tags.Get()", tagIsSet, inherited: !tagIsSet);
        if (tagListResolved != null)
        {
            foreach (var tag in tagListResolved)
            {
                if (tag == null) continue;
                var tagId = BuiltLookupTable.Instance?.GetGuid(tag) ?? tag.name;
                if (!string.IsNullOrEmpty(tagId)) tags.Add(tagId);
            }
        }
        diagnostics.AddRange(refs.Diagnostics);
        refs.Diagnostics.Clear();
        return (fields, provenance, diagnostics, tags);
    }
}
