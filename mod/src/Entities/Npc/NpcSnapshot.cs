using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Npc;

public sealed record NpcVector3Snapshot(
    [property: JsonProperty("x")] float X,
    [property: JsonProperty("y")] float Y,
    [property: JsonProperty("z")] float Z);

public sealed record NpcLevelSnapshot(
    [property: JsonProperty("automatic")] bool Automatic,
    [property: JsonProperty("addValue")] int AddValue,
    [property: JsonProperty("value")] int Value);

public sealed record NpcSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("recordRef")] SnapshotRef RecordRef,
    [property: JsonProperty("displayName")] string? DisplayName,
    [property: JsonProperty("displayNameProvenance")] string DisplayNameProvenance,
    [property: JsonProperty("displayNameOwner")] string? DisplayNameOwner,
    [property: JsonProperty("authoringLabel")] string? AuthoringLabel,
    [property: JsonProperty("characterRef")] SnapshotRef? CharacterRef,
    [property: JsonProperty("spawnPoint")] NpcVector3Snapshot Position,
    [property: JsonProperty("mapId")] string? MapId,
    [property: JsonProperty("containingLocationRefs")] IReadOnlyList<SnapshotRef> ContainingLocationRefs,
    [property: JsonProperty("dropRefs")] IReadOnlyList<SnapshotRef> DropRefs,
    [property: JsonProperty("dropRefsProvenance")] string DropRefsProvenance,
    [property: JsonProperty("dropRefsOwner")] string? DropRefsOwner,
    [property: JsonProperty("startingFactions")] IReadOnlyList<SnapshotRef> StartingFactions,
    [property: JsonProperty("startingFactionsProvenance")] string StartingFactionsProvenance,
    [property: JsonProperty("startingFactionsOwner")] string? StartingFactionsOwner,
    [property: JsonProperty("startingLevel")] NpcLevelSnapshot? StartingLevel,
    [property: JsonProperty("startingLevelProvenance")] string StartingLevelProvenance,
    [property: JsonProperty("startingLevelOwner")] string? StartingLevelOwner,
    [property: JsonProperty("merchantRefs")] IReadOnlyList<SnapshotRef> MerchantRefs,
    [property: JsonProperty("merchantRefsProvenance")] string MerchantRefsProvenance,
    [property: JsonProperty("merchantRefsOwner")] string? MerchantRefsOwner,
    [property: JsonProperty("merchantGold")] SnapshotRef? MerchantGold,
    [property: JsonProperty("merchantGoldProvenance")] string MerchantGoldProvenance,
    [property: JsonProperty("merchantGoldOwner")] string? MerchantGoldOwner,
    [property: JsonProperty("merchantCategories")] IReadOnlyList<SnapshotRef> MerchantCategories,
    [property: JsonProperty("merchantCategoriesProvenance")] string MerchantCategoriesProvenance,
    [property: JsonProperty("merchantCategoriesOwner")] string? MerchantCategoriesOwner);

public sealed class NpcSnapshotRow
{
    [JsonProperty("id")] public string Id { get; init; } = "";
    [JsonProperty("fields")] public NpcSnapshot Fields { get; init; } = null!;
    [JsonProperty("diagnostics")] public List<Diagnostic> Diagnostics { get; init; } = new();
}

public sealed class NpcSnapshotEnvelope
{
    [JsonProperty("entityId")] public string EntityId { get; init; } = "npc";
    [JsonProperty("schemaVersion")] public int SchemaVersion { get; init; } = 1;
    [JsonProperty("rows")] public List<NpcSnapshotRow> Rows { get; init; } = new();
}
