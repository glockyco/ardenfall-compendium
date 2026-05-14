using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.Item.Adapters;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Item;

public sealed class ItemExtractor : WalkerBase<ItemSnapshotRow>
{
    private readonly IItemAssetSource _source;

    public ItemExtractor()
        : this(new BuiltLookupTableItemAssetSource())
    {
    }

    public ItemExtractor(IItemAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<ItemSnapshotRow> Walk()
    {
        foreach (var asset in _source.EnumerateItems())
        {
            if (asset == null) continue;
            if (!MarkVisited(asset)) continue;

            var lookup = BuiltLookupTable.Instance;
            if (lookup == null) yield break;

            var guid = lookup.GetGuid(asset);
            if (guid is null || guid.Length == 0)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"ItemData asset '{asset.name}' has no GUID in BuiltLookupTable",
                });
                continue;
            }

            var (fields, provenance, diagnostics, tags) = ExtractItem.Extract(asset, Refs, guid);

            var classified = ItemVariantClassifier.Classify(asset);
            if (classified.VariantId == "unsupported")
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = ItemDiagnosticCodes.UnsupportedSubtype,
                    Field = "variant",
                    Message = $"item '{guid}' is type {asset.GetType().Name}; not yet supported",
                });
                continue;
            }

            foreach (var layer in classified.Layers)
            {
                Merge(fields, provenance, diagnostics, layer.Extract(asset, Refs, guid));
                if (Refs.Diagnostics.Count > 0)
                {
                    diagnostics.AddRange(Refs.Diagnostics);
                    Refs.Diagnostics.Clear();
                }
            }

            var variantId = classified.VariantId;

            yield return new ItemSnapshotRow
            {
                Id = guid,
                Variant = variantId,
                Fields = fields,
                Tags = tags,
                Provenance = provenance,
                Diagnostics = diagnostics,
            };
        }

        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    private static void Merge(Dictionary<string, object?> dst, IReadOnlyDictionary<string, object?> src)
    {
        foreach (var entry in src) dst[entry.Key] = entry.Value;
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
