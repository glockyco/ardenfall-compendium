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

            string variantId;
            if (asset is ThrowingPotionData throwingPotion)
            {
                Merge(fields, ExtractEquipment.Extract(throwingPotion));
                Merge(fields, ExtractHandItem.Extract(throwingPotion));
                Merge(fields, ExtractPrimaryHand.Extract(throwingPotion));
                Merge(fields, provenance, diagnostics, ExtractThrowingItem.Extract(throwingPotion, Refs, guid));
                Merge(fields, provenance, diagnostics, ExtractThrowingPotion.Extract(throwingPotion, Refs, guid));
                variantId = "throwing-potion";
            }
            else if (asset is ThrowingItemData throwingItem)
            {
                Merge(fields, ExtractEquipment.Extract(throwingItem));
                Merge(fields, ExtractHandItem.Extract(throwingItem));
                Merge(fields, ExtractPrimaryHand.Extract(throwingItem));
                Merge(fields, provenance, diagnostics, ExtractThrowingItem.Extract(throwingItem, Refs, guid));
                variantId = "throwing-item";
            }
            else if (asset is SlateSpellItemData slateSpell)
            {
                Merge(fields, ExtractEquipment.Extract(slateSpell));
                Merge(fields, ExtractHandItem.Extract(slateSpell));
                Merge(fields, ExtractPrimaryHand.Extract(slateSpell));
                Merge(fields, provenance, diagnostics, ExtractSlateSpell.Extract(slateSpell, Refs, guid));
                variantId = "slate-spell";
            }
            else if (asset is BowItemData bow)
            {
                Merge(fields, ExtractEquipment.Extract(bow));
                Merge(fields, ExtractHandItem.Extract(bow));
                Merge(fields, ExtractPrimaryHand.Extract(bow));
                Merge(fields, provenance, diagnostics, ExtractBow.Extract(bow, Refs, guid));
                variantId = "bow";
            }
            else if (asset is ArrowItemData arrow)
            {
                Merge(fields, ExtractEquipment.Extract(arrow));
                Merge(fields, provenance, diagnostics, ExtractArrow.Extract(arrow, Refs, guid));
                variantId = "arrow";
            }
            else if (asset is MeleeItemData melee)
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
            else if (asset is RepairKitItemData repairKit)
            {
                Merge(fields, provenance, diagnostics, ExtractRepairKit.Extract(repairKit, Refs));
                variantId = "repair-kit";
            }
            else if (asset is PotionRecipeItemData potionRecipe)
            {
                Merge(fields, provenance, diagnostics, ExtractPotionRecipe.Extract(potionRecipe, Refs, guid));
                variantId = "potion-recipe";
            }
            else if (asset is LockpickItemData lockpick)
            {
                Merge(fields, provenance, diagnostics, ExtractLockpick.Extract(lockpick, Refs));
                variantId = "lockpick";
            }
            else if (asset is CurrencyItemData)
            {
                variantId = "currency";
            }
            else if (asset is NoteItemData note)
            {
                Merge(fields, provenance, diagnostics, ExtractNote.Extract(note, Refs, guid));
                variantId = "note";
            }
            else if (asset is ConsumableItemData consumable)
            {
                Merge(fields, provenance, diagnostics, ExtractConsumable.Extract(consumable, Refs, guid));
                variantId = "consumable";
            }
            else if (asset.GetType() == typeof(ItemData))
            {
                variantId = "basic";
            }
            else
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
