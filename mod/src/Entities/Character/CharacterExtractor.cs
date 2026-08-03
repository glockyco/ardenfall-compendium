using System;
using System.Collections.Generic;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;
using ArdenfallCompendium.Walker;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Character;

public sealed class CharacterExtractor : WalkerBase<CharacterSnapshotRow>
{
    private readonly ICharacterAssetSource _source;

    public CharacterExtractor()
        : this(new BuiltLookupTableCharacterAssetSource())
    {
    }

    public CharacterExtractor(ICharacterAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<CharacterSnapshotRow> Walk()
    {
        var seenNames = new HashSet<string>(StringComparer.Ordinal);
        return ExtractorLifecycle.Run(
            _source.EnumerateCharacters(),
            Diagnostics,
            Refs,
            () => new Diagnostic
            {
                Severity = "fatal",
                Code = "characterAssetMissing",
                Field = "id",
                Message = "CharacterData asset source yielded a null row",
            },
            asset => CreateIdentity(asset, seenNames),
            (asset, id) =>
            {
                var name = NullIfEmpty(asset.CharacterName);
                if (name == null)
                {
                    Diagnostics.Add(new Diagnostic
                    {
                        Severity = "diagnostic",
                        Code = "characterNameMissing",
                        Field = "name",
                        Message = $"CharacterData '{id}' has empty or whitespace stored charName",
                    });
                }

                var dropItems = CharacterDropWalker.Flatten<
                    ItemListAsset,
                    object,
                    BaseWeightedItemData,
                    Ardenfall.Item.ItemData>(
                    roots: RootLists(asset.ItemLists),
                    listGroups: ListGroups,
                    groupEntries: GroupEntries,
                    isGroup: entry => entry is WeightedItemData weighted && weighted.isGroup,
                    entryGroups: EntryGroups,
                    isList: entry => entry.isList,
                    entryList: entry => entry.listAsset,
                    entryItem: entry => entry.singleItem,
                    listComparer: UnityReferenceComparer<ItemListAsset>.Instance,
                    itemComparer: UnityReferenceComparer<Ardenfall.Item.ItemData>.Instance);

                var additionalItems = asset.AdditionalItems ?? Array.Empty<CountedItemData>();
                var dropRefs = new List<SnapshotRef>(dropItems.Count);
                foreach (var item in dropItems)
                {
                    dropRefs.Add(Refs.ResolveAsset(
                        item,
                        "dropRefs",
                        id,
                        MissingPolicy.Diagnostic,
                        "CharacterData.itemLists"));
                }
                foreach (var counted in additionalItems)
                {
                    var item = counted?.item;
                    if (item == null || ContainsItem(dropItems, item)) continue;
                    dropItems = AddItem(dropItems, item);
                    dropRefs.Add(Refs.ResolveAsset(
                        item,
                        "dropRefs",
                        id,
                        MissingPolicy.Diagnostic,
                        "CharacterData.additionalItems"));
                }

                return new CharacterSnapshotRow
                {
                    Id = id,
                    Fields = new CharacterSnapshot(id, name, dropRefs),
                };
            });
    }

    private static ExtractorIdentity CreateIdentity(CharacterAsset asset, HashSet<string> seenNames)
    {
        var assetName = asset.AssetName ?? "";
        if (!NamedAssetIdentity.TryCreate("character", assetName, out var id))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameMissing",
                Field = "id",
                Message = $"CharacterData asset has empty or whitespace name '{assetName}'",
            });
        }
        if (!seenNames.Add(assetName))
        {
            return ExtractorIdentity.Invalid(new Diagnostic
            {
                Severity = "fatal",
                Code = "namedAssetNameDuplicate",
                Field = "id",
                Message = $"CharacterData asset name '{assetName}' is duplicated",
            });
        }
        return ExtractorIdentity.Valid(id);
    }

    private static IEnumerable<ItemListAsset> RootLists(
        IReadOnlyList<CountedItemListAsset>? lists)
    {
        if (lists == null) yield break;
        foreach (var counted in lists)
        {
            if (counted?.list != null) yield return counted.list;
        }
    }

    private static IEnumerable<object> ListGroups(ItemListAsset list)
    {
        if (list.itemGroups == null) yield break;
        foreach (var group in list.itemGroups)
        {
            if (group != null) yield return group;
        }
    }

    private static IEnumerable<BaseWeightedItemData> GroupEntries(object group) => group switch
    {
        ItemGroup itemGroup => itemGroup.items is null ? Array.Empty<BaseWeightedItemData>() : itemGroup.items,
        BaseItemGroup baseGroup => baseGroup.items is null ? Array.Empty<BaseWeightedItemData>() : baseGroup.items,
        _ => Array.Empty<BaseWeightedItemData>(),
    };

    private static IEnumerable<object> EntryGroups(BaseWeightedItemData entry)
    {
        if (entry is not WeightedItemData weighted) yield break;
        if (weighted.group != null) yield return weighted.group;
        if (weighted.groups == null) yield break;
        foreach (var group in weighted.groups)
        {
            if (group != null) yield return group;
        }
    }

    private static bool ContainsItem(
        IReadOnlyList<Ardenfall.Item.ItemData> items,
        Ardenfall.Item.ItemData item)
    {
        foreach (var existing in items)
        {
            if (ReferenceEquals(existing, item)) return true;
        }
        return false;
    }

    private static IReadOnlyList<Ardenfall.Item.ItemData> AddItem(
        IReadOnlyList<Ardenfall.Item.ItemData> items,
        Ardenfall.Item.ItemData item)
    {
        var result = new List<Ardenfall.Item.ItemData>(items.Count + 1);
        result.AddRange(items);
        result.Add(item);
        return result;
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

    private sealed class UnityReferenceComparer<T> : IEqualityComparer<T>
        where T : UnityObject
    {
        public static UnityReferenceComparer<T> Instance { get; } = new();
        public bool Equals(T? x, T? y) => ReferenceEquals(x, y);
        public int GetHashCode(T obj) => System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(obj);
    }
}
