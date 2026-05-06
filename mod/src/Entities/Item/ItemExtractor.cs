using System;
using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Entities.Item.Adapters;
using ArdenfallArchives.Walker;

namespace ArdenfallArchives.Entities.Item;

public sealed class ItemExtractor : WalkerBase<ItemSnapshotRow>
{
    public override IEnumerable<ItemSnapshotRow> Walk()
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) yield break;

        foreach (var asset in BuiltLookupTable.GetAssetsOfType<ItemData>())
        {
            if (asset == null) continue;
            if (!MarkVisited(asset)) continue;

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

            string variantId;
            if (asset is MeleeItemData melee)
            {
                Merge(fields, ExtractEquipment.Extract(melee));
                Merge(fields, ExtractHandItem.Extract(melee));
                Merge(fields, ExtractPrimaryHand.Extract(melee));
                Merge(fields, ExtractMelee.Extract(melee));
                variantId = "melee-weapon";
            }
            else if (asset is PrimaryHandItemData primary)
            {
                Merge(fields, ExtractEquipment.Extract(primary));
                Merge(fields, ExtractHandItem.Extract(primary));
                Merge(fields, ExtractPrimaryHand.Extract(primary));
                variantId = "primary-hand";
            }
            else if (asset is HandItemData hand)
            {
                Merge(fields, ExtractEquipment.Extract(hand));
                Merge(fields, ExtractHandItem.Extract(hand));
                variantId = "hand-item";
            }
            else if (asset is ArmorItemData armor)
            {
                Merge(fields, ExtractEquipment.Extract(armor));
                Merge(fields, ExtractArmor.Extract(armor));
                variantId = "armor";
            }
            else if (asset is EquipItemData equip)
            {
                Merge(fields, ExtractEquipment.Extract(equip));
                variantId = "equipment";
            }
            else
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "diagnostic",
                    Code = "itemSubtypeUnsupportedInSlice1",
                    Field = "variant",
                    Message = $"item '{guid}' is type {asset.GetType().Name}; not yet supported",
                });
                continue;
            }

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
}
