using ArdenfallCompendium.Assets;
using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
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

    public ItemExtractor(IItemAssetSource source, IconAssetPlan? assetPlan)
        : this(source)
    {
        if (source is BuiltLookupTableItemAssetSource built) built.AttachAssetPlan(assetPlan);
    }

    public override IEnumerable<ItemSnapshotRow> Walk()
    {
        return ExtractorLifecycle.Run(
            _source.EnumerateItems(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "itemAssetMissing",
                Field = "id",
                Message = "Item asset source yielded a null row",
            },
            asset =>
            {
                if (asset.Diagnostics != null) Diagnostics.AddRange(asset.Diagnostics);
                if (string.IsNullOrWhiteSpace(asset.Guid))
                {
                    return ExtractorIdentity.Invalid(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "lookupAssetGuidMissing",
                        Field = "id",
                        Message = $"ItemData asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) => asset.Snapshot);
    }
}
