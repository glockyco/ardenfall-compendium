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
                ContainingLocationRefs: new List<SnapshotRef>());
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
            ContainingLocationRefs: containingLocations);
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
