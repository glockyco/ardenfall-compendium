using System.Collections.Generic;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Entities.Npc;

public sealed record NpcRecordSourceRow(
    string? Table,
    string? Subtable,
    string? Id,
    string? DisplayName,
    string DisplayNameProvenance,
    string? DisplayNameOwner,
    string? AuthoringLabel,
    SnapshotRef? CharacterRef,
    string? MapId,
    NpcVector3Snapshot? Position,
    IReadOnlyList<SnapshotRef> ContainingLocationRefs,
    IReadOnlyList<SnapshotRef> DropRefs,
    string DropRefsProvenance,
    string? DropRefsOwner,
    IReadOnlyList<SnapshotRef> StartingFactions,
    string StartingFactionsProvenance,
    string? StartingFactionsOwner,
    NpcLevelSnapshot? StartingLevel,
    string StartingLevelProvenance,
    string? StartingLevelOwner,
    IReadOnlyList<SnapshotRef> MerchantRefs,
    string MerchantRefsProvenance,
    string? MerchantRefsOwner,
    SnapshotRef? MerchantGold,
    string MerchantGoldProvenance,
    string? MerchantGoldOwner,
    IReadOnlyList<SnapshotRef> MerchantCategories,
    string MerchantCategoriesProvenance,
    string? MerchantCategoriesOwner)
{
    public static NpcRecordSourceRow Build(
        string? table,
        string? subtable,
        string? id,
        string? displayName,
        string displayNameProvenance,
        string? displayNameOwner,
        string? authoringLabel,
        SnapshotRef? characterRef,
        string? mapId,
        NpcVector3Snapshot? position,
        IReadOnlyList<SnapshotRef>? containingLocationRefs = null,
        IReadOnlyList<SnapshotRef>? dropRefs = null,
        string dropRefsProvenance = "absent",
        string? dropRefsOwner = null,
        IReadOnlyList<SnapshotRef>? startingFactions = null,
        string startingFactionsProvenance = "absent",
        string? startingFactionsOwner = null,
        NpcLevelSnapshot? startingLevel = null,
        string startingLevelProvenance = "absent",
        string? startingLevelOwner = null,
        IReadOnlyList<SnapshotRef>? merchantRefs = null,
        string merchantRefsProvenance = "absent",
        string? merchantRefsOwner = null,
        SnapshotRef? merchantGold = null,
        string merchantGoldProvenance = "absent",
        string? merchantGoldOwner = null,
        IReadOnlyList<SnapshotRef>? merchantCategories = null,
        string merchantCategoriesProvenance = "absent",
        string? merchantCategoriesOwner = null) =>
        new(table, subtable, id, displayName, displayNameProvenance, displayNameOwner,
            authoringLabel, characterRef, mapId, position,
            containingLocationRefs ?? new List<SnapshotRef>(),
            dropRefs ?? new List<SnapshotRef>(), dropRefsProvenance, dropRefsOwner,
            startingFactions ?? new List<SnapshotRef>(), startingFactionsProvenance, startingFactionsOwner,
            startingLevel, startingLevelProvenance, startingLevelOwner,
            merchantRefs ?? new List<SnapshotRef>(), merchantRefsProvenance, merchantRefsOwner,
            merchantGold, merchantGoldProvenance, merchantGoldOwner,
            merchantCategories ?? new List<SnapshotRef>(), merchantCategoriesProvenance, merchantCategoriesOwner);
}

public interface INpcRecordSource
{
    int FilteredRuntimeCreatedCount { get; }

    IEnumerable<NpcRecordSourceRow> EnumerateNpcs();
}
