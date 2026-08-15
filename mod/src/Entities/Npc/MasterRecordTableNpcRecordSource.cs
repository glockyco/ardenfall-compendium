using System;
using System.Collections.Generic;
using System.Reflection;
using Ardenfall;
using Ardenfall.Item;
using Ardenfall.RecordSystem;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;
using UnityEngine;

namespace ArdenfallCompendium.Entities.Npc;

public sealed class MasterRecordTableNpcRecordSource : INpcRecordSource
{
    private static FieldInfo? _spawnPointField;
    private static FieldInfo? _characterNameField;

    private static FieldInfo CharacterNameField =>
        _characterNameField ??= typeof(CharacterData).GetField(
            "charName",
            BindingFlags.Instance | BindingFlags.NonPublic) ?? throw new MissingFieldException(
                typeof(CharacterData).FullName,
                "charName");
    private readonly Func<IEnumerable<NPCRecord>> _lookupNpcs;
    private readonly Func<IEnumerable<LocationAsset>> _lookupLocations;

    public int FilteredRuntimeCreatedCount { get; private set; }

    public MasterRecordTableNpcRecordSource()
        : this(
            lookupNpcs: () => ArdenfallGame.instance.worldData.masterRecordTable.GetRecords<NPCRecord>(),
            lookupLocations: () => BuiltLookupTable.GetAssetsOfType<LocationAsset>())
    {
    }

    public MasterRecordTableNpcRecordSource(
        Func<IEnumerable<NPCRecord>> lookupNpcs,
        Func<IEnumerable<LocationAsset>> lookupLocations)
    {
        _lookupNpcs = lookupNpcs;
        _lookupLocations = lookupLocations;
    }

    public IEnumerable<NpcRecordSourceRow> EnumerateNpcs()
    {
        FilteredRuntimeCreatedCount = 0;
        foreach (var record in _lookupNpcs())
        {
            if (record == null)
            {
                yield return null!;
                continue;
            }

            if (!record.IsEditorCreated())
            {
                FilteredRuntimeCreatedCount++;
                continue;
            }

            var storedCharacterData = record.StoredCharacterData;
            if (storedCharacterData == null)
            {
                FilteredRuntimeCreatedCount++;
                continue;
            }

            yield return ToRow(record, storedCharacterData, _lookupLocations());
        }
    }

    private static NpcRecordSourceRow ToRow(
        NPCRecord record,
        CharacterData storedCharacterData,
        IEnumerable<LocationAsset> locations)
    {
        var id = record.id;
        var nameResolution = ResolveDisplayName(storedCharacterData);
        var dropResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.itemLists);
        var additionalDropResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.additionalItems);
        var factionResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.startingFactions);
        var levelResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.startingLevel);
        var merchantListResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.merchantItemLists);
        var merchantAdditionalResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.merchantAdditionalItems);
        var merchantGoldResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.merchantGold);
        var merchantCategoryResolution = ParameterChain.Resolve(storedCharacterData, storedCharacterData.merchantCategories);

        // itemLists and additionalItems are one reader-facing drop fact, as in CharacterExtractor.
        var dropRefs = MergeRefs(
            FlattenItemRefs(dropResolution.Value),
            ToItemRefs(additionalDropResolution.Value, "CharacterData.additionalItems"));
        var dropOwnership = MergeOwnership(dropResolution.Ownership, additionalDropResolution.Ownership);
        // merchantItemLists and merchantAdditionalItems are one reader-facing stock fact.
        var merchantRefs = MergeRefs(
            FlattenMerchantItemRefs(merchantListResolution.Value),
            ToItemRefs(merchantAdditionalResolution.Value, "CharacterData.merchantAdditionalItems"));
        var merchantOwnership = MergeOwnership(merchantListResolution.Ownership, merchantAdditionalResolution.Ownership);
        var spawnPoint = ReadSpawnPoint(record);
        var characterRef = ResolveParentRef(storedCharacterData.parent);
        if (spawnPoint == null)
        {
            return new NpcRecordSourceRow(
                Table: id.table,
                Subtable: id.subtable,
                Id: id.id,
                DisplayName: nameResolution.Name,
                DisplayNameProvenance: nameResolution.Provenance,
                DisplayNameOwner: nameResolution.Owner,
                AuthoringLabel: NullIfEmpty(record.customFriendlyID),
                CharacterRef: characterRef,
                MapId: null,
                Position: null,
                ContainingLocationRefs: new List<SnapshotRef>(),
                DropRefs: dropRefs,
                DropRefsProvenance: dropOwnership.Provenance,
                DropRefsOwner: dropOwnership.Owner,
                StartingFactions: ToAssetRefs(factionResolution.Value, "CharacterData.startingFactions"),
                StartingFactionsProvenance: Provenance(factionResolution.Ownership),
                StartingFactionsOwner: Owner(factionResolution.Ownership),
                StartingLevel: ToLevelSnapshot(levelResolution.Value),
                StartingLevelProvenance: Provenance(levelResolution.Ownership),
                StartingLevelOwner: Owner(levelResolution.Ownership),
                MerchantRefs: merchantRefs,
                MerchantRefsProvenance: merchantOwnership.Provenance,
                MerchantRefsOwner: merchantOwnership.Owner,
                MerchantGold: ToOptionalAssetRef(merchantGoldResolution.Value, "CharacterData.merchantGold"),
                MerchantGoldProvenance: Provenance(merchantGoldResolution.Ownership),
                MerchantGoldOwner: Owner(merchantGoldResolution.Ownership),
                MerchantCategories: ToAssetRefs(merchantCategoryResolution.Value, "CharacterData.merchantCategories"),
                MerchantCategoriesProvenance: Provenance(merchantCategoryResolution.Ownership),
                MerchantCategoriesOwner: Owner(merchantCategoryResolution.Ownership));
        }

        var containingLocations = new List<SnapshotRef>();

        foreach (var location in locations)
        {
            if (location == null || !location.enabled) continue;
            if (!location.IsInside(spawnPoint.Value.position, spawnPoint.Value.map)) continue;
            containingLocations.Add(ToAssetRef(location, "NPCRecord.containingLocations"));
        }

        return new NpcRecordSourceRow(
            Table: id.table,
            Subtable: id.subtable,
            Id: id.id,
            DisplayName: nameResolution.Name,
            DisplayNameProvenance: nameResolution.Provenance,
            DisplayNameOwner: nameResolution.Owner,
            AuthoringLabel: NullIfEmpty(record.customFriendlyID),
            CharacterRef: characterRef,
            MapId: spawnPoint.Value.map?.id,
            Position: new NpcVector3Snapshot(
                spawnPoint.Value.position.x,
                spawnPoint.Value.position.y,
                spawnPoint.Value.position.z),
            ContainingLocationRefs: containingLocations,
            DropRefs: dropRefs,
            DropRefsProvenance: dropOwnership.Provenance,
            DropRefsOwner: dropOwnership.Owner,
            StartingFactions: ToAssetRefs(factionResolution.Value, "CharacterData.startingFactions"),
            StartingFactionsProvenance: Provenance(factionResolution.Ownership),
            StartingFactionsOwner: Owner(factionResolution.Ownership),
            StartingLevel: ToLevelSnapshot(levelResolution.Value),
            StartingLevelProvenance: Provenance(levelResolution.Ownership),
            StartingLevelOwner: Owner(levelResolution.Ownership),
            MerchantRefs: merchantRefs,
            MerchantRefsProvenance: merchantOwnership.Provenance,
            MerchantRefsOwner: merchantOwnership.Owner,
            MerchantGold: ToOptionalAssetRef(merchantGoldResolution.Value, "CharacterData.merchantGold"),
            MerchantGoldProvenance: Provenance(merchantGoldResolution.Ownership),
            MerchantGoldOwner: Owner(merchantGoldResolution.Ownership),
            MerchantCategories: ToAssetRefs(merchantCategoryResolution.Value, "CharacterData.merchantCategories"),
            MerchantCategoriesProvenance: Provenance(merchantCategoryResolution.Ownership),
            MerchantCategoriesOwner: Owner(merchantCategoryResolution.Ownership));
    }

    private static IReadOnlyList<SnapshotRef> FlattenItemRefs(
        IReadOnlyList<CountedItemListAsset>? lists)
    {
        var items = ItemListWalker.Flatten<
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

    private static IReadOnlyList<SnapshotRef> FlattenMerchantItemRefs(
        IReadOnlyList<CountedLeveledItemListAsset>? lists)
    {
        var roots = new List<CountedItemListAsset>();
        foreach (var counted in lists ?? Array.Empty<CountedLeveledItemListAsset>())
        {
            if (counted?.list != null) roots.Add(counted.list);
        }
        return FlattenItemRefs(roots);
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
            refs.Add(ToAssetRef(item, source));
        }
        return refs;
    }

    private static IReadOnlyList<SnapshotRef> MergeRefs(
        IReadOnlyList<SnapshotRef> first,
        IReadOnlyList<SnapshotRef> second)
    {
        var merged = new List<SnapshotRef>(first.Count + second.Count);
        AddRefs(merged, first);
        AddRefs(merged, second);
        return merged;
    }

    private static void AddRefs(List<SnapshotRef> target, IReadOnlyList<SnapshotRef> refs)
    {
        foreach (var reference in refs)
        {
            if (!target.Contains(reference)) target.Add(reference);
        }
    }

    private static (string Provenance, string? Owner) MergeOwnership(
        ParameterOwnership first,
        ParameterOwnership second)
    {
        // A merged fact is own when either contributing parameter is set on the placement.
        if (first.IsSet || second.IsSet) return ("own", null);
        if (first.Inherited) return ("inherited", Owner(first));
        if (second.Inherited) return ("inherited", Owner(second));
        return ("absent", null);
    }

    private static string Provenance(ParameterOwnership ownership) =>
        ownership.IsSet ? "own" : ownership.Inherited ? "inherited" : "absent";

    private static string? Owner(ParameterOwnership ownership) =>
        ownership.Inherited ? NullIfEmpty(ownership.Owner?.name) : null;

    private static NpcLevelSnapshot? ToLevelSnapshot(LevelValue? value) => value == null
        ? null
        : new NpcLevelSnapshot(value.automatic, value.addValue, value.value);

    private static SnapshotRef? ToOptionalAssetRef(UnityEngine.Object? asset, string source) =>
        asset == null ? null : ToAssetRef(asset, source);

    private static IEnumerable<ItemListAsset> RootLists(IReadOnlyList<CountedItemListAsset>? lists)
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

    private static (string? Name, string Provenance, string? Owner) ResolveDisplayName(
        CharacterData storedCharacterData)
    {
        var parameter = CharacterNameField.GetValue(storedCharacterData) as CharacterRandomNameParameter;
        if (parameter == null)
        {
            return (null, "absent", null);
        }

        var resolution = ParameterChain.Resolve(storedCharacterData, parameter);
        var name = NullIfEmpty(resolution.Value?.name);
        if (name == null)
        {
            return (null, "absent", null);
        }

        if (resolution.Ownership.IsSet)
        {
            return (name, "own", null);
        }

        if (resolution.Ownership.Inherited)
        {
            return (name, "inherited", NullIfEmpty(resolution.Ownership.Owner?.name));
        }

        return (name, "absent", null);
    }

    private static SnapshotRef ResolveParentRef(ParameterizedObject? parent)
    {
        if (parent == null) return SnapshotRef.Missing("noParent", "ParameterizedObject.parent");
        return string.IsNullOrWhiteSpace(parent.name)
            ? SnapshotRef.Missing("parentNameMissing", "ParameterizedObject.parent")
            : SnapshotRef.NamedAsset("character", parent.name);
    }

    private static WorldPosition? ReadSpawnPoint(NPCRecord record)
    {
        var field = _spawnPointField ??= typeof(NPCRecord).GetField(
            "spawnPoint",
            BindingFlags.Instance | BindingFlags.NonPublic) ?? throw new MissingFieldException(
                typeof(NPCRecord).FullName,
                "spawnPoint");
        var stored = (WorldPosition)field.GetValue(record)!;
        if (!stored.IsNull) return stored;

        var transform = record.transform;
        return transform == null
            ? null
            : new WorldPosition(transform.position, transform.GetMapData());
    }

    private static SnapshotRef ToAssetRef(UnityEngine.Object asset, string source)
    {
        var guid = BuiltLookupTable.Instance?.GetGuid(asset);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", source)
            : SnapshotRef.LookupAsset(guid, asset.GetType().FullName, asset.name);
    }

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;
}
