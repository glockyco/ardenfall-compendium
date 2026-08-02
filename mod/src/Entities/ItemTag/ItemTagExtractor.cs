using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
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

    public override IEnumerable<ItemTagSnapshotRow> Walk()
    {
        foreach (var asset in _source.EnumerateItemTags())
        {
            if (asset == null)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "itemTagAssetMissing",
                    Field = "id",
                    Message = "ItemTag asset source yielded a null row",
                });
                continue;
            }
            var id = asset.Guid;
            if (string.IsNullOrWhiteSpace(id))
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"ItemTag asset '{asset.AssetName}' has no GUID in BuiltLookupTable",
                });
                continue;
            }

            yield return new ItemTagSnapshotRow
            {
                Id = id,
                Fields = new ItemTagSnapshot(
                    Id: id,
                    TagName: NullIfEmpty(asset.TagName) ?? NullIfEmpty(asset.AssetName) ?? id,
                    Description: asset.Description ?? ""),
            };
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
