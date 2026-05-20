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
            var guid = asset.Guid;
            if (string.IsNullOrWhiteSpace(guid))
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
                Id = guid,
                Fields = new ItemTagSnapshot(
                    Id: guid,
                    TagName: NullIfEmpty(asset.TagName) ?? NullIfEmpty(asset.AssetName) ?? guid,
                    Description: asset.Description ?? ""),
            };
        }
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
