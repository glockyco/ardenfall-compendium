using System.Collections.Generic;
using Ardenfall.Item;
using ArdenfallCompendium.Entities.Item;

namespace ArdenfallCompendium.Tests;

internal sealed class CountingItemAssetSource : IItemAssetSource
{
    public int WalkCount { get; private set; }

    public IEnumerable<ItemData> EnumerateItems()
    {
        WalkCount++;
        yield break;
    }
}
