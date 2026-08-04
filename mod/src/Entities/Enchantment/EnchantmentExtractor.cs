using System;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.Enchantment;

public sealed class EnchantmentExtractor : WalkerBase<EnchantmentSnapshotRow>
{
    private readonly IEnchantmentAssetSource _source;

    public EnchantmentExtractor()
        : this(new LoadedEnchantmentAssetSource())
    {
    }

    public EnchantmentExtractor(IEnchantmentAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<EnchantmentSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateEnchantments(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "enchantmentAssetMissing",
                Field = "id",
                Message = "EnchantmentData asset source yielded a null row",
            },
            asset =>
            {
                if (string.IsNullOrWhiteSpace(asset.Guid))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "lookupAssetGuidMissing",
                        Field = "id",
                        Message = $"EnchantmentData asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) =>
            {
                var enchantmentName = NullIfEmpty(asset.EnchantmentName);
                if (enchantmentName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "enchantmentNameMissing",
                        Field = "enchantmentName",
                        Message = $"EnchantmentData '{id}' has empty or whitespace enchantmentName",
                    });
                }

                if (asset.BlacklistEntryCount > 0)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "enchantmentBlacklistPresent",
                        Field = "baseItemDataFilterBlacklist",
                        Message = $"EnchantmentData '{id}' has {asset.BlacklistEntryCount} baseItemDataFilterBlacklist entries. The blacklist is not a can-enchant list.",
                    });
                }

                var itemRefs = new List<SnapshotRef>();
                foreach (var itemRef in asset.AppliesToItemRefs ?? Array.Empty<SnapshotRef>())
                {
                    if (itemRef != null) itemRefs.Add(itemRef);
                }

                var effects = new List<EnchantmentEffectSnapshot>();
                var ordinal = 0;
                foreach (var effect in asset.Effects ?? Array.Empty<EnchantmentEffectAsset>())
                {
                    if (effect == null) continue;
                    effects.Add(new EnchantmentEffectSnapshot(
                        Ordinal: ordinal++,
                        Kind: effect.Kind,
                        StatusEffectRef: effect.Kind == "StatusEffectEnchantmentEffect"
                            ? effect.StatusEffectRef
                            : null));
                }

                return new EnchantmentSnapshotRow
                {
                    Id = id,
                    Fields = new EnchantmentSnapshot(
                        Id: id,
                        EnchantmentName: enchantmentName,
                        MoneyValue: asset.MoneyValue,
                        HideEffectTooltips: asset.HideEffectTooltips,
                        AppliesToItemRefs: itemRefs,
                        Effects: effects),
                };
            });
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
