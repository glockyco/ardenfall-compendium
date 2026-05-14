using System.Collections.Generic;
using Ardenfall;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item;

public sealed class BuiltLookupTableItemAssetSource : IItemAssetSource
{
    public IEnumerable<ItemData> EnumerateItems() => BuiltLookupTable.GetAssetsOfType<ItemData>();
}
