using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item.Adapters;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item;

public sealed class BuiltLookupTableItemAssetSource : IItemAssetSource
{
    private readonly Func<IEnumerable<ItemData>> _lookupItems;
    private readonly Func<ItemData, string?> _lookupGuid;
    private ItemIconAssetPlan? _assetPlan;

    public BuiltLookupTableItemAssetSource()
        : this(
            lookupItems: () => BuiltLookupTable.GetAssetsOfType<ItemData>(),
            lookupGuid: LookupGuid)
    {
    }

    public BuiltLookupTableItemAssetSource(
        Func<IEnumerable<ItemData>> lookupItems,
        Func<ItemData, string?>? lookupGuid = null)
    {
        _lookupItems = lookupItems;
        _lookupGuid = lookupGuid ?? LookupGuid;
    }

    public void AttachAssetPlan(ItemIconAssetPlan? assetPlan) => _assetPlan = assetPlan;

    public IEnumerable<ItemAsset> EnumerateItems()
    {
        foreach (var asset in _lookupItems())
        {
            if (asset == null)
            {
                yield return new ItemAsset(null, "", null);
                continue;
            }

            var guid = _lookupGuid(asset);
            if (string.IsNullOrWhiteSpace(guid))
            {
                yield return new ItemAsset(
                    Guid: null,
                    AssetName: asset.name ?? "",
                    Snapshot: null);
                continue;
            }

            yield return BuildAsset(asset, guid);
        }
    }

    private ItemAsset BuildAsset(ItemData asset, string guid)
    {
        var refs = new RefResolver();
        var (fields, provenance, diagnostics, tags) = ExtractItem.Extract(asset, refs, guid);
        if (fields["name"] is not string itemName || string.IsNullOrWhiteSpace(itemName))
        {
            fields["name"] = null;
            diagnostics.Add(new Diagnostic
            {
                Severity = "diagnostic",
                Code = "itemNameMissing",
                Field = "name",
                Message = $"ItemData '{guid}' has empty or whitespace itemName",
            });
        }

        var classified = ItemVariantClassifier.Classify(asset);
        if (classified.VariantId == "unsupported")
        {
            diagnostics.Add(new Diagnostic
            {
                Severity = "fatal",
                Code = ItemDiagnosticCodes.UnsupportedSubtype,
                Field = "variant",
                Message = $"item '{guid}' is type {asset.GetType().Name}; not yet supported",
            });
            return new ItemAsset(guid, asset.name ?? "", null, diagnostics);
        }

        var presentationOnlyFields = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var layer in classified.Layers)
        {
            var result = layer.Extract(asset, refs, guid);
            Merge(fields, provenance, diagnostics, result);
            Merge(presentationOnlyFields, result.PresentationOnlyFields);
            if (refs.Diagnostics.Count > 0)
            {
                diagnostics.AddRange(refs.Diagnostics);
                refs.Diagnostics.Clear();
            }
        }

        var row = new ItemSnapshotRow
        {
            Id = guid,
            Variant = classified.VariantId,
            Fields = fields,
            Tags = tags,
            Presentation = ItemPresentationBuilder.FromExtractedFields(
                guid,
                classified.VariantId,
                fields,
                provenance,
                presentationOnlyFields),
            Provenance = provenance,
            Diagnostics = diagnostics,
        };
        if (_assetPlan != null) ItemIconAssetPlanner.CaptureItem(_assetPlan, asset, guid);
        return new ItemAsset(guid, asset.name ?? "", row);
    }

    private static string? LookupGuid(ItemData asset) =>
        BuiltLookupTable.Instance?.GetGuid(asset);

    private static void Merge(Dictionary<string, object?> destination, IReadOnlyDictionary<string, object?> source)
    {
        foreach (var entry in source) destination[entry.Key] = entry.Value;
    }

    private static void Merge(
        Dictionary<string, object?> fields,
        Dictionary<string, Provenance> provenance,
        List<Diagnostic> diagnostics,
        ItemAdapterResult result)
    {
        Merge(fields, result.Fields);
        foreach (var entry in result.Provenance) provenance[entry.Key] = entry.Value;
        diagnostics.AddRange(result.Diagnostics);
    }
}
