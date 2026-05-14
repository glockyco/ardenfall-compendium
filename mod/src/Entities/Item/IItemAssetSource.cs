using System.Collections.Generic;
using Ardenfall.Item;

namespace ArdenfallCompendium.Entities.Item;

public interface IItemAssetSource
{
    IEnumerable<ItemData> EnumerateItems();
}
