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
            if (asset == null)
            {
                yield return null!;
                continue;
            }

            var parameter = CharacterNameField.GetValue(asset) as CharacterRandomNameParameter;
            var storedName = parameter?.Get()?.name;
            var itemRefs = FlattenItemRefs(asset.itemLists.Get());
            var additionalRefs = ToItemRefs(asset.additionalItems.Get(), "CharacterData.additionalItems");
            var factionRefs = ToAssetRefs(asset.startingFactions.Get(), "CharacterData.startingFactions");
            var parentRef = ResolveParentRef(asset.parent);
            var raceRef = ResolveRaceRef(asset.Race);
            yield return new CharacterAsset(
                AssetName: asset.name,
                CharacterName: NullIfEmpty(storedName),
                ItemRefs: itemRefs,
                AdditionalItemRefs: additionalRefs,
                StartingFactions: factionRefs,
                ParentRef: parentRef,
                RaceRef: raceRef);
        }
    }

    private static SnapshotRef ResolveParentRef(ParameterizedObject? parent)
    {
        if (parent == null) return SnapshotRef.Missing("noParent", "ParameterizedObject.parent");
        return string.IsNullOrWhiteSpace(parent.name)
            ? SnapshotRef.Missing("parentNameMissing", "ParameterizedObject.parent")
            : SnapshotRef.NamedAsset("character", parent.name);
    }

    private static SnapshotRef? ResolveRaceRef(Ardenfall.CharacterRace? race)
    {
        if (race == null || string.IsNullOrWhiteSpace(race.name)) return null;
        return SnapshotRef.NamedAsset("character-race", race.name);
    }

    private static IReadOnlyList<SnapshotRef> FlattenItemRefs(IReadOnlyList<CountedItemListAsset>? lists)
    {
        return ToAssetRefs(ItemLists.Flatten(lists), "CharacterData.itemLists");
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





    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
