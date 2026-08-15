using System;
using System.Collections.Generic;

namespace ArdenfallCompendium.Entities;

/// <summary>
/// Enumerates every reachable leaf in nested item-list structures without rolling them.
/// The delegates keep this walk independent of Unity, so cycles can be tested with
/// ordinary reference types.
/// </summary>
public static class ItemListWalker
{
    public static IReadOnlyList<TItem> Flatten<TList, TGroup, TEntry, TItem>(
        IEnumerable<TList>? roots,
        Func<TList, IEnumerable<TGroup>?> listGroups,
        Func<TGroup, IEnumerable<TEntry>?> groupEntries,
        Func<TEntry, bool> isGroup,
        Func<TEntry, IEnumerable<TGroup>?> entryGroups,
        Func<TEntry, bool> isList,
        Func<TEntry, TList?> entryList,
        Func<TEntry, TItem?> entryItem,
        IEqualityComparer<TList>? listComparer = null,
        IEqualityComparer<TItem>? itemComparer = null)
        where TList : class
        where TGroup : class
        where TEntry : class
        where TItem : class
    {
        var seenLists = new HashSet<TList>(listComparer ?? ReferenceComparer<TList>.Instance);
        var seenGroups = new HashSet<TGroup>(ReferenceComparer<TGroup>.Instance);
        var seenEntries = new HashSet<TEntry>(ReferenceComparer<TEntry>.Instance);
        var seenItems = new HashSet<TItem>(itemComparer ?? ReferenceComparer<TItem>.Instance);
        var items = new List<TItem>();

        void VisitList(TList? list)
        {
            if (list == null || !seenLists.Add(list)) return;
            foreach (var group in listGroups(list) ?? Array.Empty<TGroup>())
            {
                if (group == null || !seenGroups.Add(group)) continue;
                foreach (var entry in groupEntries(group) ?? Array.Empty<TEntry>())
                {
                    VisitEntry(entry);
                }
            }
        }

        void VisitEntry(TEntry? entry)
        {
            if (entry == null || !seenEntries.Add(entry)) return;
            if (isGroup(entry))
            {
                foreach (var group in entryGroups(entry) ?? Array.Empty<TGroup>())
                {
                    if (group == null || !seenGroups.Add(group)) continue;
                    foreach (var child in groupEntries(group) ?? Array.Empty<TEntry>())
                    {
                        VisitEntry(child);
                    }
                }
                return;
            }

            if (isList(entry))
            {
                VisitList(entryList(entry));
                return;
            }

            var item = entryItem(entry);
            if (item != null && seenItems.Add(item)) items.Add(item);
        }

        foreach (var root in roots ?? Array.Empty<TList>()) VisitList(root);
        return items;
    }

    private sealed class ReferenceComparer<T> : IEqualityComparer<T>
        where T : class
    {
        public static ReferenceComparer<T> Instance { get; } = new();
        public bool Equals(T? x, T? y) => ReferenceEquals(x, y);
        public int GetHashCode(T value) => System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(value);
    }
}
