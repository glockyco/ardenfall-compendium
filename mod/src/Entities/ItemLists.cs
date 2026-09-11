using System;
using System.Collections.Generic;
using Ardenfall.Item;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities;

/// <summary>
/// Flattens the game's nested item lists into the items they can yield.
/// </summary>
/// <remarks>
/// Every consumer of `ItemListAsset` needs the same traversal: groups, nested groups and nested
/// lists, without rolling weights and without revisiting a cycle. It lives here once, so an NPC's
/// drops, a merchant's stock and a container's loot cannot disagree about what a list contains.
/// </remarks>
public static class ItemLists
{
    /// <summary>The distinct items the given lists can yield, in traversal order.</summary>
    public static IReadOnlyList<ItemData> Flatten(IEnumerable<CountedItemListAsset>? lists) =>
        ItemListWalker.Flatten<ItemListAsset, object, BaseWeightedItemData, ItemData>(
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

    /// <summary>The same traversal, as references for a snapshot row.</summary>
    public static IReadOnlyList<SnapshotRef> FlattenToRefs(
        IEnumerable<CountedItemListAsset>? lists,
        string source,
        Func<UnityEngine.Object, string, SnapshotRef> toRef)
    {
        var refs = new List<SnapshotRef>();
        foreach (var item in Flatten(lists)) refs.Add(toRef(item, source));
        return refs;
    }

    private static IEnumerable<ItemListAsset> RootLists(IEnumerable<CountedItemListAsset>? lists)
    {
        foreach (var counted in lists ?? Array.Empty<CountedItemListAsset>())
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
        ItemGroup itemGroup =>
            itemGroup.items is null ? Array.Empty<BaseWeightedItemData>() : itemGroup.items,
        BaseItemGroup baseGroup =>
            baseGroup.items is null ? Array.Empty<BaseWeightedItemData>() : baseGroup.items,
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
}
