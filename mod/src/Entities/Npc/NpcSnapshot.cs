using System.Collections.Generic;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.Npc;

public sealed record NpcVector3Snapshot(
    [property: JsonProperty("x")] float X,
    [property: JsonProperty("y")] float Y,
    [property: JsonProperty("z")] float Z);

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
    [property: JsonProperty("containingLocationRefs")] IReadOnlyList<SnapshotRef> ContainingLocationRefs);

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
