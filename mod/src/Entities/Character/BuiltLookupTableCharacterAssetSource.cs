using System;
using System.Collections.Generic;
using System.Reflection;
using Ardenfall;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities;

namespace ArdenfallCompendium.Entities.Character;

public sealed class BuiltLookupTableCharacterAssetSource : ICharacterAssetSource
{
    private static FieldInfo? _characterNameField;

    private static FieldInfo CharacterNameField =>
        _characterNameField ??= typeof(CharacterData).GetField(
            "charName",
            BindingFlags.Instance | BindingFlags.NonPublic) ?? throw new MissingFieldException(
                typeof(CharacterData).FullName,
                "charName");

    public IEnumerable<CharacterAsset> EnumerateCharacters()
    {
        _ = CharacterNameField;
        foreach (var asset in BuiltLookupTable.GetAssetsOfType<CharacterData>())
        {
            if (asset == null) continue;

            var parameter = CharacterNameField.GetValue(asset) as CharacterRandomNameParameter;
            var storedName = parameter?.Get()?.name;
            var itemRefs = FlattenItemRefs(asset.itemLists.Get());
            var additionalRefs = ToItemRefs(asset.additionalItems.Get(), "CharacterData.additionalItems");
            var factionRefs = ToAssetRefs(asset.startingFactions.Get(), "CharacterData.startingFactions");
            yield return new CharacterAsset(
                AssetName: asset.name,
                CharacterName: NullIfEmpty(storedName),
                ItemRefs: itemRefs,
                AdditionalItemRefs: additionalRefs,
                StartingFactions: factionRefs);
        }
    }

    private static IReadOnlyList<SnapshotRef> FlattenItemRefs(IReadOnlyList<CountedItemListAsset>? lists)
    {
        var items = CharacterDropWalker.Flatten<
            ItemListAsset,
            object,
            BaseWeightedItemData,
            ItemData>(
                roots: RootLists(lists),
                listGroups: ListGroups,
                groupEntries: GroupEntries,
                isGroup: entry => entry is WeightedItemData weighted && weighted.isGroup,
                entryGroups: EntryGroups,
                isList: entry => entry.isList,
                entryList: entry => entry.listAsset,
                entryItem: entry => entry.singleItem,
                listComparer: UnityObjectReferenceComparer<ItemListAsset>.Instance,
                itemComparer: UnityObjectReferenceComparer<ItemData>.Instance);
        return ToAssetRefs(items, "CharacterData.itemLists");
    }

    private static IReadOnlyList<SnapshotRef> ToItemRefs(
        IEnumerable<CountedItemData>? items,
        string source)
    {
        var itemAssets = new List<ItemData>();
        foreach (var counted in items ?? Array.Empty<CountedItemData>())
        {
            if (counted?.item != null) itemAssets.Add(counted.item);
        }
        return ToAssetRefs(itemAssets, source);
    }

    private static IReadOnlyList<SnapshotRef> ToAssetRefs<T>(
        IEnumerable<T>? items,
        string source)
        where T : UnityEngine.Object
    {
        var refs = new List<SnapshotRef>();
        foreach (var item in items ?? Array.Empty<T>())
        {
            if (item == null) continue;
            var lookup = BuiltLookupTable.Instance?.GetGuid(item);
            refs.Add(string.IsNullOrWhiteSpace(lookup)
                ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
                : SnapshotRef.LookupAsset(lookup, item.GetType().FullName, item.name));
        }
        return refs;
    }

    private static IEnumerable<ItemListAsset> RootLists(IReadOnlyList<CountedItemListAsset>? lists)
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

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
