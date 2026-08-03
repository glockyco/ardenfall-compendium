using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.ItemTag;

public sealed class ItemTagExtractor : WalkerBase<ItemTagSnapshotRow>
{
    private readonly IItemTagAssetSource _source;

    public ItemTagExtractor()
        : this(new BuiltLookupTableItemTagAssetSource())
    {
    }

    public ItemTagExtractor(IItemTagAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<ItemTagSnapshotRow> Walk() =>
        ExtractorLifecycle.Run(
            _source.EnumerateItemTags(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "itemTagAssetMissing",
                Field = "id",
                Message = "ItemTag asset source yielded a null row",
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
                        Message = $"ItemTag asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                    });
                }
                return ExtractorIdentity.Valid(asset.Guid);
            },
            (asset, id) =>
            {
                var tagName = NullIfEmpty(asset.TagName);
                if (tagName == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "itemTagNameMissing",
                        Field = "tagName",
                        Message = $"ItemTag '{id}' has empty or whitespace tagName",
                    });
                }

                return new ItemTagSnapshotRow
                {
                    Id = id,
                    Fields = new ItemTagSnapshot(
                        Id: id,
                        TagName: tagName,
                        Description: asset.Description ?? ""),
                };
            });

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
